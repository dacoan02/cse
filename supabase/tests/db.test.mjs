// Teste ale regulilor din baza de date, rulate pe Postgres (PGlite).
// Rulare: node supabase/tests/db.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sql = (f) => readFileSync(join(here, f), "utf8");
const db = new PGlite();

let passed = 0, failed = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { passed++; console.log("  ✔", name); }
  else { failed++; console.log("  ✘", name, extra); }
};

async function asUser(uid) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  if (uid) await db.exec("set role authenticated");
}
async function asAdmin() { await asUser(null); }
async function q(text, params) { return (await db.query(text, params)).rows; }
async function fails(text, params) {
  try { await db.query(text, params); return null; } catch (e) { return e.message; }
}

await db.exec(sql("mock_supabase.sql"));
for (const f of ["001_schema.sql", "002_functions.sql", "003_rls.sql", "004_announcement_files.sql"]) {
  const migration = join(here, "..", "migrations", f);
  await db.exec(readFileSync(migration, "utf8"));
}
console.log("Migrările au rulat fără erori.\n");

// ---------- date de bază (ca service_role) ----------
const U = {
  pres: "00000000-0000-0000-0000-000000000001",
  sec: "00000000-0000-0000-0000-000000000002",
  vp: "00000000-0000-0000-0000-000000000003",
  rep1: "00000000-0000-0000-0000-000000000011",
  rep2: "00000000-0000-0000-0000-000000000012",
  rep3: "00000000-0000-0000-0000-000000000013",
  other: "00000000-0000-0000-0000-000000000099",
};
await asAdmin();
const [inst] = await q("insert into institutions (name) values ('Liceul Test') returning id");
const [inst2] = await q("insert into institutions (name) values ('Alt Liceu') returning id");
const [year] = await q("insert into school_years (institution_id,label) values ($1,'2026–2027') returning id", [inst.id]);
const roles = [["pres","presedinte"],["sec","secretar"],["vp","vicepresedinte"],["rep1","reprezentant"],["rep2","reprezentant"],["rep3","reprezentant"]];
for (const [k, r] of roles) {
  await q("insert into auth.users (id,email) values ($1,$2)", [U[k], k + "@test.ro"]);
  await q("insert into profiles (id,institution_id,full_name,role) values ($1,$2,$3,$4)", [U[k], inst.id, "Nume " + k, r]);
}
await q("insert into auth.users (id,email) values ($1,'o@t.ro')", [U.other]);
await q("insert into profiles (id,institution_id,full_name,role) values ($1,$2,'Alt Președinte','presedinte')", [U.other, inst2.id]);

// ---------- Adunarea Generală: 25 reprezentanți ----------
console.log("Adunarea Generală și cvorum");
await asUser(U.pres);
const cls = [];
for (let i = 0; i < 25; i++) {
  const [c] = await q("insert into classes (name) values ($1) returning id", ["Clasa " + i]);
  cls.push(c.id);
}
ok("institution_id și anul școlar se completează implicit", (await q("select count(*)::int n from classes"))[0].n === 25);
const repIds = [];
for (let i = 0; i < 25; i++) {
  const profile = i === 0 ? U.rep1 : i === 1 ? U.rep2 : i === 2 ? U.rep3 : null;
  const [r] = await q("insert into representatives (full_name, class_id, profile_id) values ($1,$2,$3) returning id",
    ["Elev " + i, cls[i], profile]);
  repIds.push(r.id);
}
ok("un reprezentant nu poate avea două clase în același an",
  (await fails("insert into representatives (full_name, class_id, profile_id) values ('Dublu',$1,$2)", [cls[5], U.rep1])) !== null);

const [meeting] = await q(
  "insert into meetings (title, starts_at, location, reason, status, q_met) values ('Ședință test', now() + interval '3 days', 'Sala 1', 'Test', 'published', true) returning id, status, q_met");
ok("ședința inserată de client rămâne ciornă (status și cvorum forțate)", meeting.status === "draft" && meeting.q_met === false);
ok("clientul nu poate publica direct prin UPDATE",
  (await fails("update meetings set status='published' where id=$1", [meeting.id])) !== null);
ok("nu se poate publica fără destinatari",
  (await fails("select publish_meeting($1)", [meeting.id])) !== null);
await q("select set_meeting_recipients($1, true, '{}', $2)", [meeting.id, [U.vp]]);
await q("select publish_meeting($1)", [meeting.id]);
let [m] = await q("select * from meetings where id=$1", [meeting.id]);
ok("ședința e publicată", m.status === "published");
ok("total reprezentanți activi = 25, prag = 13", m.q_total === 25 && m.q_required === 13);
ok("la început cvorumul este neîntrunit", m.q_met === false && m.q_pending === 25);

const notifRep1 = await (async () => { await asUser(U.rep1); return q("select * from notifications"); })();
ok("reprezentantul convocat primește notificare la publicare", notifRep1.length === 1 && notifRep1[0].type === "meeting_published");
await asUser(U.vp);
ok("vicepreședintele adăugat ca destinatar primește notificare", (await q("select * from notifications")).length === 1);

// prezența: 12 prezenți => neîntrunit, 13 => întrunit
await asUser(U.pres);
const parts = await q("select id, representative_id from meeting_participants where meeting_id=$1", [meeting.id]);
for (let i = 3; i < 14; i++) {
  const p = parts.find((x) => x.representative_id === repIds[i]);
  await q("select set_attendance_for($1,'present')", [p.id]);
}
await asUser(U.rep1);
await q("select set_attendance($1,'present')", [meeting.id]); // 12 prezenți
await asUser(U.pres);
[m] = await q("select * from meetings where id=$1", [meeting.id]);
ok("12 din 25 prezenți: CVORUM NEÎNTRUNIT", m.q_present === 12 && m.q_met === false);
await asUser(U.rep2);
await q("select set_attendance($1,'present')", [meeting.id]); // 13
await asUser(U.pres);
[m] = await q("select * from meetings where id=$1", [meeting.id]);
ok("13 din 25 prezenți: CVORUM ÎNTRUNIT", m.q_present === 13 && m.q_met === true);
ok("președintele primește notificare la atingerea cvorumului",
  (await q("select * from notifications where type='quorum_reached'")).length === 1);

await asUser(U.rep3);
await q("select set_attendance($1,'absent')", [meeting.id]);
await asUser(U.pres);
[m] = await q("select * from meetings where id=$1", [meeting.id]);
ok("absența declarată nu se numără ca prezență", m.q_present === 13 && m.q_absent === 1 && m.q_pending === 11);

// dezactivarea unui reprezentant prezent schimbă totalul și prezența
await q("update representatives set status='inactive' where id=$1", [repIds[10]]);
[m] = await q("select * from meetings where id=$1", [meeting.id]);
ok("dezactivarea recalculează totalul (24) și pragul (13)", m.q_total === 24 && m.q_required === 13 && m.q_present === 12 && m.q_met === false);
await q("update representatives set status='active' where id=$1", [repIds[10]]);

// ---------- Securitate ----------
console.log("\nSecuritate și roluri");
await asUser(U.rep1);
ok("reprezentantul nu își poate schimba rolul",
  (await fails("update profiles set role='presedinte' where id=$1", [U.rep1])) !== null);
ok("reprezentantul nu poate crea ședințe",
  (await fails("insert into meetings (title, starts_at) values ('x', now() + interval '1 day')")) !== null);
ok("reprezentantul nu vede profilurile altora", (await q("select id from profiles")).length === 1);
ok("reprezentantul nu vede tabelul reprezentanților (doar propriul rând)",
  (await q("select id from representatives")).length === 1);
ok("lista publică a Adunării este vizibilă", (await q("select id from assembly_directory")).length === 25);
ok("reprezentantul nu poate confirma prezența la o ședință la care nu e convocat",
  (await (async () => { await asUser(U.vp); return fails("select set_attendance($1,'present')", [meeting.id]); })()) === null);
await asUser(U.rep1);
ok("reprezentantul nu poate corecta prezența altcuiva",
  (await fails("select set_attendance_for($1,'present')", [parts[5].id])) !== null);
ok("reprezentantul nu poate citi jurnalul", (await q("select id from audit_log")).length === 0);
ok("reprezentantul nu poate scrie în jurnal", (await fails("insert into audit_log (action, entity_type) values ('x','y')")) !== null);

await asUser(U.other);
ok("izolare între instituții: alt președinte nu vede ședințele", (await q("select id from meetings")).length === 0);
ok("izolare între instituții: nu vede reprezentanții", (await q("select id from representatives")).length === 0);

await asUser(U.sec);
await fails("update profiles set role='reprezentant', is_active=false where id=$1", [U.pres]);
await fails("update profiles set permissions='{\"manage_votes\":true}' where id=$1", [U.sec]);
await asAdmin();
ok("secretarul nu poate demite/modifica drepturile președintelui",
  (await q("select role, is_active from profiles where id=$1", [U.pres]))[0].role === "presedinte" &&
  (await q("select is_active from profiles where id=$1", [U.pres]))[0].is_active === true);
ok("secretarul nu își poate acorda singur drepturi",
  JSON.stringify((await q("select permissions p from profiles where id=$1", [U.sec]))[0].p) === "{}");
await asUser(U.sec);
ok("secretarul vede lista reprezentanților", (await q("select id from representatives")).length === 25);
ok("secretarul nu poate înregistra măsuri administrative",
  (await fails("insert into admin_measures (representative_id, kind, reason, created_by) values ($1,'avertisment','x',$2)", [repIds[0], U.sec])) !== null);
ok("secretarul nu poate crea voturi", (await fails("select create_vote('{}'::jsonb)")) !== null);

// ---------- Voturi ----------
console.log("\nVoturi");
await asUser(U.pres);
const [{ create_vote: voteId }] = await q(
  `select create_vote(jsonb_build_object('title','Vot secret','question','Aprobați?','vote_type','da_nu_abtinere',
     'is_secret', true, 'show_interim', false, 'starts_at', now() - interval '1 minute',
     'ends_at', now() + interval '1 day', 'eligible_scope','reprezentanti'))`);
const [v] = await q("select * from votes where id=$1", [voteId]);
ok("votul se deschide imediat și are 3 opțiuni", v.status === "deschis" && (await q("select * from vote_options where vote_id=$1", [voteId])).length === 3);
ok("clientul nu poate insera direct un vot", (await fails("insert into votes (title,question,vote_type,starts_at,ends_at) values ('a','b','da_nu',now(),now()+interval '1 day')")) !== null);

await asUser(U.rep1);
const opts = await q("select id,label from vote_options where vote_id=$1", [voteId]);
const da = opts.find((o) => o.label === "Da").id, nu = opts.find((o) => o.label === "Nu").id;
await q("select cast_vote($1,$2)", [voteId, da]);
ok("votul duplicat este refuzat", (await fails("select cast_vote($1,$2)", [voteId, nu])) !== null);
ok("buletinele nu sunt accesibile direct", (await fails("select * from ballots")) !== null || (await q("select * from ballots")).length === 0);
let t = (await q("select vote_tally($1) t", [voteId]))[0].t;
ok("rezultatele intermediare ascunse când nu sunt permise", t.results_visible === false && t.voted === 1);
await asUser(U.rep2);
await q("select cast_vote($1,$2)", [voteId, da]);
await asUser(U.rep3);
await q("select cast_vote($1,$2)", [voteId, nu]);
await asUser(U.vp);
ok("vicepreședintele nu are drept de vot (scope = reprezentanți)", (await fails("select cast_vote($1,$2)", [voteId, da])) !== null);
await asAdmin();
const ballots = await q("select profile_id, cast_at from ballots where vote_id=$1", [voteId]);
ok("la votul secret buletinele nu conțin identitatea votantului", ballots.length === 3 && ballots.every((b) => b.profile_id === null && b.cast_at === null));
ok("participarea e înregistrată separat", (await q("select * from vote_participation where vote_id=$1", [voteId])).length === 3);
await asUser(U.pres);
await q("select close_vote($1)", [voteId]);
[{ t }] = await q("select vote_tally($1) t", [voteId]);
ok("după închidere: 2 Da, 1 Nu, rezultat Adoptat, participare calculată",
  t.results_visible && t.outcome === "Adoptat" && t.eligible === 3 && t.voted === 3 &&
  t.options.find((o) => o.label === "Da").count === 2);
ok("la vot secret nu se pot lista alegerile individuale", (await fails("select * from vote_public_choices($1)", [voteId])) !== null);
ok("votul închis nu mai acceptă voturi", await (async () => { await asUser(U.rep1); return (await fails("select cast_vote($1,$2)", [voteId, da])) !== null; })());

// ---------- Jurnal, măsuri, încheierea ședinței ----------
console.log("\nJurnal, măsuri disciplinare, arhivare");
await asUser(U.pres);
const [meas] = await q("insert into admin_measures (representative_id, kind, reason, created_by) values ($1,'avertisment','Absențe repetate',$2) returning id", [repIds[3], U.pres]);
ok("măsura nu poate fi ștearsă", (await fails("delete from admin_measures where id=$1", [meas.id])) !== null);
ok("măsura nu poate fi rescrisă", (await fails("update admin_measures set reason='altceva' where id=$1", [meas.id])) !== null);
ok("demitere cere stare a procedurii",
  (await fails("insert into admin_measures (representative_id, kind, reason, created_by) values ($1,'demitere','x',$2)", [repIds[4], U.pres])) !== null);
ok("jurnalul nu poate fi modificat", (await fails("update audit_log set action='x'")) !== null && (await fails("delete from audit_log")) !== null);
const audit = await q("select action from audit_log where institution_id=$1", [inst.id]);
const actions = new Set(audit.map((a) => a.action));
for (const a of ["meetings.insert", "meetings.published", "representatives.insert", "admin_measures.insert", "votes.inchis", "attendance.updated"])
  ok("jurnal conține " + a, actions.has(a));

await q("select finish_meeting($1, null, 'Decizie test')", [meeting.id]);
[m] = await q("select * from meetings where id=$1", [meeting.id]);
const snap = await q("select status, count(*)::int n from meeting_attendance_snapshot where meeting_id=$1 group by 1", [meeting.id]);
ok("ședința e desfășurată și cvorumul final e păstrat", m.status === "held" && m.q_present === 13 && m.q_met === true);
ok("situația finală a prezenței e salvată pentru toți cei 25", snap.reduce((s, x) => s + x.n, 0) === 25);
await q("update representatives set status='inactive' where id=$1", [repIds[5]]);
[m] = await q("select * from meetings where id=$1", [meeting.id]);
ok("după încheiere, modificările din Adunare nu schimbă cvorumul înregistrat", m.q_total === 25 && m.q_present === 13);
ok("o ședință încheiată nu mai poate fi editată", (await fails("update meetings set title='alt titlu' where id=$1", [meeting.id])) !== null);
ok("prezența nu se mai poate schimba după încheiere", await (async () => { await asUser(U.rep1); return (await fails("select set_attendance($1,'absent')", [meeting.id])) !== null; })());

// ---------- Sesizări, anunțuri, remindere ----------
console.log("\nSesizări, anunțuri, remindere");
await asUser(U.rep1);
const [fb] = await q("insert into feedback_items (author_id, kind, title, description, class_id) values ($1,'propunere','Titlu','Descriere',$2) returning id", [U.rep1, cls[0]]);
ok("reprezentantul își vede sesizarea", (await q("select id from feedback_items")).length === 1);
ok("reprezentantul nu poate seta singur răspuns oficial / stare",
  (await fails("insert into feedback_items (author_id, kind, title, description, status) values ($1,'propunere','t','d','solutionat')", [U.rep1])) !== null);
ok("autorul nu poate modifica sesizarea după trimitere", (await q("update feedback_items set title='x' where id=$1 returning id", [fb.id])).length === 0);
await asUser(U.rep2);
ok("alt reprezentant nu vede sesizarea", (await q("select id from feedback_items")).length === 0);
await asUser(U.pres);
ok("președintele a fost notificat de sesizare", (await q("select * from notifications where type='feedback_new'")).length === 1);
await q("update feedback_items set status='solutionat', official_response='Rezolvat' where id=$1", [fb.id]);
await asUser(U.rep1);
const nres = await q("select * from notifications where type='feedback_resolved'");
ok("autorul este notificat când sesizarea e soluționată", nres.length === 1);

await asUser(U.pres);
await q("select publish_announcement('Salut','Conținut','conducere', true, '{}')");
await asUser(U.rep1);
ok("anunțul pentru conducere nu e vizibil reprezentanților", (await q("select id from announcements")).length === 0);
await asUser(U.vp);
ok("anunțul pentru conducere e vizibil vicepreședintelui", (await q("select id from announcements")).length === 1);

// ---------- Fișiere atașate anunțurilor și documente ale măsurilor (migrarea 004) ----------
console.log("Documente de anunț și de măsuri");
await asUser(U.pres);
const [{ publish_announcement: annSel }] = await q("select publish_announcement('Doar câțiva','x','selectie', false, $1::uuid[])", [[U.rep1]]);
const [{ publish_announcement: annLead }] = await q("select publish_announcement('Conducere','x','conducere', false, '{}')");
await q("insert into documents (title,category,storage_path,file_name,uploaded_by,announcement_id) values ('A1','altele','p/a1.pdf','a1.pdf',$1,$2)", [U.pres, annSel]);
await q("insert into documents (title,category,storage_path,file_name,uploaded_by,announcement_id) values ('A2','altele','p/a2.pdf','a2.pdf',$1,$2)", [U.pres, annLead]);
await asUser(U.rep1);
ok("destinatarul selectat vede fișierul anunțului", (await q("select 1 from documents where announcement_id=$1", [annSel])).length === 1);
ok("fișierul unui anunț pentru conducere nu e vizibil reprezentantului", (await q("select 1 from documents where announcement_id=$1", [annLead])).length === 0);
await asUser(U.rep2);
ok("reprezentantul neselectat nu vede fișierul anunțului", (await q("select 1 from documents where announcement_id=$1", [annSel])).length === 0);
await asUser(U.vp);
ok("vicepreședintele vede fișierul anunțului pentru conducere", (await q("select 1 from documents where announcement_id=$1", [annLead])).length === 1);
ok("fără dreptul manage_announcements nu poate atașa fișiere la anunț",
  !!(await fails("insert into documents (title,category,storage_path,file_name,uploaded_by,announcement_id) values ('X','altele','p/x.pdf','x.pdf',$1,$2)", [U.vp, annSel])));
await asUser(U.pres);
await q("update profiles set permissions='{\"manage_announcements\":true}' where id=$1", [U.vp]);
await asUser(U.vp);
const [{ publish_announcement: annVp }] = await q("select publish_announcement('De la VP','x','toti', false, '{}')");
ok("vicepreședintele delegat poate atașa fișiere la propriul anunț",
  (await fails("insert into documents (title,category,storage_path,file_name,uploaded_by,announcement_id) values ('V','altele','p/v.pdf','v.pdf',$1,$2)", [U.vp, annVp])) === null);
await asUser(U.pres);
const [anyRep] = await q("select id from representatives limit 1");
const [measDoc] = await q("insert into admin_measures (representative_id,kind,reason,created_by) values ($1,'avertisment','Test',$2) returning id", [anyRep.id, U.pres]);
await q("insert into documents (title,category,storage_path,file_name,uploaded_by,visibility,measure_id) values ('Dovadă','administrativ','p/m.pdf','m.pdf',$1,'conducere',$2)", [U.pres, measDoc.id]);
ok("președintele vede documentul justificativ al măsurii", (await q("select 1 from documents where measure_id=$1", [measDoc.id])).length === 1);
await asUser(U.vp);
ok("vicepreședintele nu vede documentul justificativ al măsurii", (await q("select 1 from documents where measure_id=$1", [measDoc.id])).length === 0);
await asUser(U.sec);
ok("secretarul nu vede documentul justificativ al măsurii", (await q("select 1 from documents where measure_id=$1", [measDoc.id])).length === 0);

await asUser(U.pres);
const [m2] = await q("insert into meetings (title, starts_at) values ('Reminder', now() + interval '50 minutes') returning id");
await q("select set_meeting_recipients($1, true)", [m2.id]);
await q("select publish_meeting($1)", [m2.id]);
await asAdmin();
ok("remindere deja depășite la publicare (24h, 1h) nu se trimit", (await q("select send_due_reminders() n"))[0].n === 0);
await q("update meetings set starts_at = now() - interval '1 minute' where id=$1", [m2.id]); // simulăm trecerea timpului
ok("reminderul de la ora începerii se trimite o singură dată",
  (await q("select send_due_reminders() n"))[0].n === 1 && (await q("select send_due_reminders() n"))[0].n === 0);
ok("reminderul ajunge la participanți", (await q("select * from notifications where type='meeting_reminder'")).length >= 3);

// ---------- Anul școlar nou ----------
await asUser(U.pres);
const [{ start_new_school_year: ny }] = await q("select start_new_school_year('2027–2028', null, null, false)");
ok("anul nou păstrează istoricul și copiază clasele",
  (await q("select count(*)::int n from classes where school_year_id=$1", [ny]))[0].n === 25 &&
  (await q("select count(*)::int n from meetings where school_year_id=$1", [year.id]))[0].n >= 1);
ok("noua Adunare pornește goală", (await q("select count(*)::int n from representatives where school_year_id=$1", [ny]))[0].n === 0);

console.log(`\n${passed} teste trecute, ${failed} eșuate.`);
process.exit(failed ? 1 : 0);

import Link from "next/link";
import { CalendarDays, FolderKanban, MessageSquareText, Users, Vote, Activity, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { avg } from "@/lib/stats";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, QuorumBadge, Stat, buttonClass } from "@/components/ui";
import { MyAttendance } from "@/components/attendance-controls";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ATTENDANCE_LABEL, MEETING_TYPE_LABEL, ROLE_LABEL } from "@/lib/labels";
import { ATTENDANCE_TONE } from "@/lib/tones";
import { formatDateTime, pct, relativeTime } from "@/lib/format";
import { setAttendanceAction } from "@/app/actions/meetings";
import type { Meeting } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function Page({ searchParams }: { searchParams: Promise<{ acces?: string }> }) {
  const { acces } = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  const y = s.year?.id ?? "";
  await supabase.rpc("run_scheduled_jobs");
  const head = (t: string) => supabase.from(t).select("id", { count: "exact", head: true });

  const [nextR, heldR, upcomingR, repsR, projRunR, actRunR, fbAllR, fbPendR, notifR, votesR, myVotesR, annR, projListR, actListR, myPartR, fbMineR, auditR] = await Promise.all([
    supabase.from("meetings").select("*").in("status", ["published", "in_progress"]).gte("starts_at", new Date(Date.now() - 6 * 3600_000).toISOString()).order("starts_at").limit(1),
    supabase.from("meetings").select("id,q_present,q_total,status").eq("school_year_id", y).in("status", ["held"]),
    head("meetings").eq("school_year_id", y).in("status", ["published", "in_progress"]),
    s.isLeadership ? head("representatives").eq("school_year_id", y).eq("status", "active") : supabase.from("assembly_directory").select("id", { count: "exact", head: true }).eq("school_year_id", y),
    head("projects").eq("school_year_id", y).eq("status", "in_desfasurare"),
    head("activities").eq("school_year_id", y).eq("status", "in_desfasurare"),
    s.can("view_feedback") ? head("feedback_items").eq("school_year_id", y) : Promise.resolve({ count: 0 }),
    s.can("view_feedback") ? head("feedback_items").eq("school_year_id", y).in("status", ["nou", "in_analiza"]) : Promise.resolve({ count: 0 }),
    supabase.from("notifications").select("*").eq("user_id", s.userId).eq("is_read", false).eq("is_archived", false).order("created_at", { ascending: false }).limit(5),
    supabase.from("votes").select("id,title,ends_at,is_secret").eq("status", "deschis").order("ends_at"),
    supabase.from("vote_participation").select("vote_id").eq("profile_id", s.userId),
    supabase.from("announcements").select("id,title,content,published_at,pinned").order("pinned", { ascending: false }).order("published_at", { ascending: false }).limit(3),
    supabase.from("projects").select("id,title,status").eq("school_year_id", y).in("status", ["in_desfasurare", "aprobat"]).limit(4),
    supabase.from("activities").select("id,title,starts_at,status").eq("school_year_id", y).in("status", ["in_desfasurare", "planificata"]).order("starts_at").limit(4),
    supabase.from("meeting_participants").select("status,meetings!inner(id,title,starts_at,status,school_year_id)").eq("profile_id", s.userId).eq("meetings.status", "held").eq("meetings.school_year_id", y),
    supabase.from("feedback_items").select("id,title,status,created_at").eq("author_id", s.userId).order("created_at", { ascending: false }).limit(4),
    s.can("view_audit") ? supabase.from("audit_log").select("id,actor_name,summary,action,created_at").order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
  ]);
  const next = (nextR.data?.[0] ?? null) as Meeting | null;
  const held = (heldR.data ?? []) as any[];
  const avgPart = avg(held.map((m) => pct(m.q_present, m.q_total)));
  const voted = new Set((myVotesR.data ?? []).map((v: any) => v.vote_id));
  const openVotes = (votesR.data ?? []) as any[];
  const unreadN = notifR.data ?? [];
  const myParts = (myPartR.data ?? []) as any[];
  const myPresent = myParts.filter((p) => p.status === "present" || p.status === "present_by_organizer").length;
  const myAbsent = myParts.filter((p) => p.status === "absent").length;
  let myStatus: string | null = null;
  if (next) { const { data } = await supabase.from("meeting_participants").select("status").eq("meeting_id", next.id).eq("profile_id", s.userId).maybeSingle(); myStatus = data?.status ?? null; }
  const hour = new Date().getHours();

  return (
    <>
      <RealtimeRefresh tables={["meetings", "votes", "feedback_items", "announcements"]} />
      <PageHeader title={`${hour < 12 ? "Bună dimineața" : hour < 18 ? "Bună ziua" : "Bună seara"}, ${s.profile.full_name.split(" ")[0]}`} description={`${ROLE_LABEL[s.profile.role]} · ${s.institution.council_name}${s.year ? ` · ${s.year.label}` : ""}`} />
      {acces === "refuzat" && <div className="mb-4"><Alert tone="warn">Nu ai acces la pagina solicitată.</Alert></div>}

      {s.isPresident && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Reprezentanți activi" value={repsR.count ?? 0} icon={<Users className="h-4 w-4" />} />
          <Stat label="Ședințe organizate" value={held.length} hint={`${upcomingR.count ?? 0} viitoare`} icon={<CalendarDays className="h-4 w-4" />} />
          <Stat label="Media participării" value={held.length ? `${avgPart}%` : "—"} hint="la ședințele desfășurate" />
          <Stat label="Proiecte active" value={projRunR.count ?? 0} hint={`${actRunR.count ?? 0} activități în desfășurare`} icon={<FolderKanban className="h-4 w-4" />} />
          <Stat label="Sesizări și propuneri" value={fbAllR.count ?? 0} icon={<MessageSquareText className="h-4 w-4" />} />
          <Stat label="Așteaptă răspuns" value={fbPendR.count ?? 0} hint={(fbPendR.count ?? 0) > 0 ? "necesită atenție" : "la zi"} />
          <Stat label="Voturi active" value={openVotes.length} icon={<Vote className="h-4 w-4" />} />
          <Stat label="Notificări necitite" value={unreadN.length} />
        </div>)}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Următoarea ședință" action={next && <Link href={`/sedinte/${next.id}`} className="text-sm text-brand hover:underline">Detalii →</Link>} />
            {next ? (
              <div className="space-y-4 p-5">
                <div><p className="text-lg font-semibold">{next.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Clock className="h-4 w-4" aria-hidden />{formatDateTime(next.starts_at)} · {relativeTime(next.starts_at)} · <Badge>{MEETING_TYPE_LABEL[next.meeting_type]}</Badge></p>
                  {next.reason && <p className="mt-2 text-sm">{next.reason}</p>}</div>
                {s.canFollow && <div className="rounded-lg bg-surface2 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><QuorumBadge met={next.q_met} large /><span className="text-sm text-muted">{next.q_present} prezenți · {next.q_required} necesari · {next.q_total} reprezentanți activi</span></div>
                  <ProgressBar value={pct(next.q_present, next.q_total)} label="Prezență confirmată" tone={next.q_met ? "ok" : "warn"} />
                  <p className="mt-2 text-xs text-muted">{next.q_present} confirmați · {next.q_absent} absenți · {next.q_pending} nu au răspuns</p></div>}
                {myStatus && <MyAttendance status={myStatus} locked={false} confirm={setAttendanceAction.bind(null, next.id, "present")} decline={setAttendanceAction.bind(null, next.id, "absent")} />}
              </div>) : <div className="p-5"><EmptyState title="Nicio ședință programată" description={s.can("manage_meetings") ? "Programează următoarea ședință." : "Vei fi notificat când este convocată o ședință."} action={s.can("manage_meetings") ? <Link href="/sedinte/nou" className={buttonClass()}>Programează o ședință</Link> : undefined} /></div>}
          </Card>

          {openVotes.length > 0 && <Card><CardHeader title="Voturi active" />
            <ul className="divide-y divide-line">{openVotes.map((v) => (<li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div><Link href={`/voturi/${v.id}`} className="font-medium text-brand hover:underline">{v.title}</Link><p className="text-xs text-muted">Se încheie {relativeTime(v.ends_at)}</p></div>
              {voted.has(v.id) ? <Badge tone="ok">Ai votat</Badge> : <Link href={`/voturi/${v.id}`} className={buttonClass("primary", "sm")}>Votează</Link>}</li>))}</ul></Card>}

          {!s.isObserver && <Card><CardHeader title="Anunțuri" action={<Link href="/anunturi" className="text-sm text-brand hover:underline">Toate →</Link>} />
            {(annR.data ?? []).length === 0 ? <p className="p-5 text-sm text-muted">Niciun anunț.</p> : <ul className="divide-y divide-line">{(annR.data ?? []).map((a: any) => <li key={a.id} className="px-5 py-3 text-sm"><p className="font-medium">{a.title}</p><p className="line-clamp-2 text-muted">{a.content}</p><p className="mt-1 text-xs text-muted">{relativeTime(a.published_at)}</p></li>)}</ul>}</Card>}

          {s.isPresident || s.can("view_audit") ? (
            <Card><CardHeader title="Activitate recentă" subtitle="Cele mai importante acțiuni din platformă" action={<Link href="/istoric" className="text-sm text-brand hover:underline">Jurnal complet →</Link>} />
              {(auditR.data ?? []).length === 0 ? <p className="p-5 text-sm text-muted">Nicio activitate înregistrată încă.</p> :
                <ol className="space-y-3 p-5">{(auditR.data as any[]).map((e) => (<li key={e.id} className="flex gap-3 text-sm"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /><div><p>{e.summary ?? e.action}</p><p className="text-xs text-muted">{e.actor_name ?? "Sistem"} · {relativeTime(e.created_at)}</p></div></li>))}</ol>}</Card>) : null}
        </div>

        <div className="space-y-6">
          <Card><CardHeader title="Notificări necitite" action={<Link href="/notificari" className="text-sm text-brand hover:underline">Toate →</Link>} />
            {unreadN.length === 0 ? <p className="p-5 text-sm text-muted">Ești la zi. Nicio notificare necitită.</p> : <ul className="divide-y divide-line">{unreadN.map((n: any) => <li key={n.id} className="px-5 py-3 text-sm"><Link href={n.link ?? "/notificari"} className="font-medium hover:text-brand">{n.title}</Link><p className="text-xs text-muted">{relativeTime(n.created_at)}</p></li>)}</ul>}</Card>

          {!s.isObserver && (myParts.length > 0 || s.profile.role !== "presedinte") ? <Card><CardHeader title="Participarea mea" subtitle="La ședințele desfășurate" />
            <div className="space-y-3 p-5 text-sm">{myParts.length === 0 ? <p className="text-muted">Nu ai încă ședințe desfășurate.</p> : <>
              <div className="flex items-end justify-between"><span className="text-3xl font-semibold tabular-nums">{pct(myPresent, myParts.length)}%</span><span className="text-muted">{myPresent} prezențe din {myParts.length}</span></div>
              <ProgressBar value={pct(myPresent, myParts.length)} label="Participarea mea" tone="ok" /><p className="text-xs text-muted">{myAbsent} absențe declarate · {myParts.length - myPresent - myAbsent} fără răspuns</p>
              <ul className="divide-y divide-line border-t border-line">{myParts.sort((a, b) => +new Date(b.meetings.starts_at) - +new Date(a.meetings.starts_at)).slice(0, 4).map((p, i) => <li key={i} className="flex items-center justify-between gap-2 py-2"><span className="truncate">{p.meetings.title}</span><Badge tone={ATTENDANCE_TONE[p.status]}>{ATTENDANCE_LABEL[p.status]}</Badge></li>)}</ul></>}</div></Card> : null}

          <Card><CardHeader title="Proiecte și activități" action={<Link href="/proiecte" className="text-sm text-brand hover:underline">Toate →</Link>} />
            <ul className="divide-y divide-line">{(projListR.data ?? []).map((p: any) => <li key={p.id} className="px-5 py-3 text-sm"><Link href={`/proiecte/${p.id}`} className="font-medium hover:text-brand">{p.title}</Link></li>)}
              {(actListR.data ?? []).map((a: any) => <li key={a.id} className="px-5 py-3 text-sm"><span className="font-medium">{a.title}</span><p className="text-xs text-muted">{formatDateTime(a.starts_at)}</p></li>)}
              {(projListR.data ?? []).length + (actListR.data ?? []).length === 0 && <li className="p-5 text-sm text-muted">Nimic în desfășurare.</li>}</ul></Card>

          {s.profile.role === "reprezentant" && <Card><CardHeader title="Mesajele mele" action={<Link href="/vocea-reprezentantilor/nou" className="text-sm text-brand hover:underline">Transmite →</Link>} />
            {(fbMineR.data ?? []).length === 0 ? <div className="space-y-3 p-5 text-sm text-muted"><p>Ai o problemă sau o idee pentru școală?</p><Link href="/vocea-reprezentantilor/nou" className={buttonClass("primary", "sm")}>Transmite o problemă sau o propunere</Link></div> :
              <ul className="divide-y divide-line">{(fbMineR.data as any[]).map((f) => <li key={f.id} className="px-5 py-3 text-sm"><Link href={`/vocea-reprezentantilor/${f.id}`} className="font-medium hover:text-brand">{f.title}</Link><p className="text-xs text-muted">{f.status.replace("_", " ")}</p></li>)}</ul>}</Card>}
          {s.profile.role !== "reprezentant" && s.can("view_feedback") && !s.isPresident && <Card className="p-5 text-sm"><p className="font-medium">Sesizări în așteptare</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fbPendR.count ?? 0}</p><Link href="/vocea-reprezentantilor" className="mt-2 inline-block text-brand hover:underline">Deschide →</Link></Card>}
        </div>
      </div>
    </>
  );
}

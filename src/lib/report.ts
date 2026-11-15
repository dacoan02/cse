import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStats, type Stats } from "@/lib/statistics";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, MEETING_STATUS_LABEL, MEETING_TYPE_LABEL, PROJECT_STATUS_LABEL, REP_STATUS_LABEL, VOTE_TYPE_LABEL } from "@/lib/labels";

import type { Section } from "@/lib/report-files";
const d = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" }) : "");
const dt = (v: string) => new Date(v).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", dateStyle: "short", timeStyle: "short" });

export async function buildReport(supabase: SupabaseClient, yearId: string, f: { from?: string; to?: string; classId?: string; repId?: string }) {
  const st: Stats = await loadStats(supabase, yearId, f);
  const [{ data: reps }, { data: fb }] = await Promise.all([
    supabase.from("representatives").select("full_name,position,status,mandate_start,classes(name)").eq("school_year_id", yearId).order("full_name"),
    supabase.from("feedback_items").select("title,kind,status,importance,created_at,resolved_at,classes(name)").eq("school_year_id", yearId).order("created_at"),
  ]);
  const sections: Section[] = [
    { title: "Rezumat", headers: ["Indicator", "Valoare"], rows: [
      ["Reprezentanți activi", st.activeReps], ["Ședințe (total)", st.meetings.total], ["Ședințe desfășurate", st.meetings.held], ["Ședințe anulate", st.meetings.cancelled],
      ["Cvorum întrunit (% din ședințele desfășurate)", `${st.meetings.quorumPct}%`], ["Media prezenței", `${st.meetings.avgAttendance}%`],
      ["Voturi organizate", st.votes.total], ["Voturi finalizate", st.votes.closed], ["Participare medie la vot", `${st.votes.avgParticipation}%`],
      ["Sesizări primite", st.feedback.total], ["Sesizări soluționate", st.feedback.solved], ["Timp mediu de soluționare (zile)", st.feedback.avgDays],
      ["Proiecte", st.projects.total], ["Proiecte în desfășurare", st.projects.running], ["Proiecte finalizate", st.projects.finished], ["Activități", st.projects.activities.total],
    ] },
    { title: "Componența Adunării Generale", headers: ["Nr.", "Nume și prenume", "Clasa", "Funcția", "Statut", "Început mandat"],
      rows: ((reps ?? []) as any[]).map((r, i) => [i + 1, r.full_name, r.classes?.name ?? "", r.position, REP_STATUS_LABEL[r.status], d(r.mandate_start)]) },
    { title: "Ședințe organizate și cvorum", headers: ["Ședința", "Tip", "Data", "Stare", "Total activi", "Prag cvorum", "Prezenți", "Absenți", "Fără răspuns", "Cvorum", "Participare"],
      rows: st.meetingRows.map((m: any) => [m.title, MEETING_TYPE_LABEL[m.meeting_type], dt(m.starts_at), MEETING_STATUS_LABEL[m.status], m.q_total, m.q_required, m.q_present, m.q_absent, m.q_pending,
        m.status === "cancelled" ? "—" : m.q_met ? "ÎNTRUNIT" : "NEÎNTRUNIT", m.q_total ? `${Math.round((1000 * m.q_present) / m.q_total) / 10}%` : "—"]) },
    { title: "Prezența reprezentanților (ședințe desfășurate)", headers: ["Reprezentant", "Clasa", "Prezent", "Absent", "Fără răspuns", "Participare"],
      rows: st.representatives.map((r) => [r.name, r.cls, r.present, r.absent, r.noResponse, r.held ? `${r.pct}%` : "—"]) },
    { title: "Voturi și decizii", headers: ["Vot", "Tip vot", "Rezultat", "Distribuție opțiuni", "Eligibili", "Au votat", "Participare"],
      rows: st.votes.results.map((v) => [v.title, v.secret ? "Secret" : "Public", v.outcome, v.options.map((o) => `${o.label}: ${o.count}`).join("; "), v.eligible, v.voted, `${v.participation}%`]) },
    { title: "Proiecte desfășurate", headers: ["Proiect", "Stadiu", "Început", "Sfârșit", "Sarcini finalizate", "Progres"],
      rows: st.projects.list.map((p: any) => [p.title, PROJECT_STATUS_LABEL[p.status], d(p.starts_on), d(p.ends_on), `${p.done}/${p.tasks}`, `${p.progress}%`]) },
    { title: "Sesizări primite și soluționate", headers: ["Titlu", "Tip", "Clasa", "Stare", "Primită", "Soluționată"],
      rows: ((fb ?? []) as any[]).map((x) => [x.title, FEEDBACK_KIND_LABEL[x.kind], x.classes?.name ?? "", FEEDBACK_STATUS_LABEL[x.status], d(x.created_at), d(x.resolved_at)]) },
  ];
  return { sections, stats: st };
}
void VOTE_TYPE_LABEL;

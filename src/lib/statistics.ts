import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avg } from "@/lib/stats";

export interface StatFilters { from?: string; to?: string; classId?: string; repId?: string }

export function resolvePeriod(sp: { perioada?: string; de_la?: string; pana_la?: string }, yearStart?: string | null): { from?: string; to?: string; label: string } {
  const today = new Date(); const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (sp.perioada === "luna") { const d = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(d), to: iso(today), label: "luna curentă" }; }
  if (sp.perioada === "semestru") { const d = new Date(today); d.setMonth(d.getMonth() - 6); return { from: iso(d), to: iso(today), label: "ultimele 6 luni" }; }
  if (sp.de_la || sp.pana_la) return { from: sp.de_la, to: sp.pana_la, label: `${sp.de_la ?? "început"} – ${sp.pana_la ?? "prezent"}` };
  return { from: yearStart ?? undefined, label: "întregul an școlar" };
}

const pct1 = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);

export async function loadStats(supabase: SupabaseClient, yearId: string, f: StatFilters) {
  let mq = supabase.from("meetings").select("id,title,meeting_type,status,starts_at,q_total,q_required,q_present,q_absent,q_pending,q_met,decisions").eq("school_year_id", yearId).neq("status", "draft").order("starts_at");
  if (f.from) mq = mq.gte("starts_at", f.from); if (f.to) mq = mq.lte("starts_at", f.to + "T23:59:59");
  const [{ data: m }, { data: reps }, { data: classes }] = await Promise.all([
    mq,
    supabase.from("representatives").select("id,full_name,class_id,status,mandate_start,classes(name)").eq("school_year_id", yearId),
    supabase.from("classes").select("id,name").eq("school_year_id", yearId).order("name"),
  ]);
  const meetings = (m ?? []) as any[];
  const held = meetings.filter((x) => x.status === "held");
  const meetingStats = {
    total: meetings.length, ordinary: meetings.filter((x) => x.meeting_type === "ordinara").length, extraordinary: meetings.filter((x) => x.meeting_type === "extraordinara").length,
    held: held.length, cancelled: meetings.filter((x) => x.status === "cancelled").length, upcoming: meetings.filter((x) => ["published", "in_progress"].includes(x.status)).length,
    quorumPct: pct1(held.filter((x) => x.q_met).length, held.length), avgAttendance: avg(held.map((x) => pct1(x.q_present, x.q_total))),
    evolution: held.map((x) => ({ label: new Date(x.starts_at).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" }), title: x.title, pct: pct1(x.q_present, x.q_total), present: x.q_present, total: x.q_total, quorum: x.q_met })),
  };

  // participare
  const heldIds = held.map((x) => x.id);
  const repRows = ((reps ?? []) as any[]).filter((r) => (!f.classId || r.class_id === f.classId) && (!f.repId || r.id === f.repId));
  const per = new Map<string, { held: number; present: number; absent: number; noResponse: number }>();
  if (heldIds.length) {
    const { data: parts } = await supabase.from("meeting_participants").select("representative_id,status,meeting_id").in("meeting_id", heldIds).not("representative_id", "is", null).limit(50000);
    for (const p of (parts ?? []) as any[]) {
      const e = per.get(p.representative_id) ?? { held: 0, present: 0, absent: 0, noResponse: 0 };
      e.held++; if (p.status === "present" || p.status === "present_by_organizer") e.present++; else if (p.status === "absent") e.absent++; else e.noResponse++;
      per.set(p.representative_id, e);
    }
  }
  const representatives = repRows.map((r) => { const e = per.get(r.id) ?? { held: 0, present: 0, absent: 0, noResponse: 0 }; return { id: r.id, name: r.full_name as string, cls: r.classes?.name as string ?? "", status: r.status as string, ...e, pct: pct1(e.present, e.held) }; })
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));
  const byClass = ((classes ?? []) as any[]).filter((c) => !f.classId || c.id === f.classId).map((c) => {
    const rs = representatives.filter((r) => r.cls === c.name); const h = rs.reduce((a, r) => a + r.held, 0), p = rs.reduce((a, r) => a + r.present, 0);
    return { name: c.name as string, reps: rs.length, pct: pct1(p, h), present: p, held: h };
  }).filter((c) => c.reps > 0);

  // voturi
  let vq = supabase.from("votes").select("id,title,vote_type,status,is_secret,starts_at,result,meeting_id").eq("school_year_id", yearId).neq("status", "draft").order("starts_at");
  if (f.from) vq = vq.gte("starts_at", f.from); if (f.to) vq = vq.lte("starts_at", f.to + "T23:59:59");
  const votes = ((await vq).data ?? []) as any[];
  const closed = votes.filter((v) => v.status === "inchis");
  const voteStats = {
    total: votes.length, closed: closed.length, open: votes.filter((v) => v.status === "deschis").length, scheduled: votes.filter((v) => v.status === "programat").length,
    avgParticipation: avg(closed.map((v) => Number(v.result?.participation_pct ?? 0))),
    results: closed.map((v) => ({ id: v.id, title: v.title as string, secret: v.is_secret as boolean, outcome: (v.result?.outcome ?? "") as string, eligible: v.result?.eligible ?? 0, voted: v.result?.voted ?? 0, participation: v.result?.participation_pct ?? 0, options: (v.result?.options ?? []) as { label: string; count: number }[] })),
  };

  // sesizări
  let fq = supabase.from("feedback_items").select("id,kind,status,class_id,importance,created_at,resolved_at,title").eq("school_year_id", yearId);
  if (f.from) fq = fq.gte("created_at", f.from); if (f.to) fq = fq.lte("created_at", f.to + "T23:59:59"); if (f.classId) fq = fq.eq("class_id", f.classId);
  const fb = ((await fq).data ?? []) as any[];
  const count = (key: string) => fb.reduce<Record<string, number>>((a, x) => { a[x[key]] = (a[x[key]] ?? 0) + 1; return a; }, {});
  const resolved = fb.filter((x) => x.resolved_at);
  const feedbackStats = {
    total: fb.length, byStatus: count("status"), byKind: count("kind"),
    inReview: fb.filter((x) => ["nou", "in_analiza"].includes(x.status)).length, solved: fb.filter((x) => x.status === "solutionat").length, rejected: fb.filter((x) => x.status === "respins").length,
    avgDays: avg(resolved.map((x) => (+new Date(x.resolved_at) - +new Date(x.created_at)) / 86400000)),
    byClass: Object.entries(fb.reduce<Record<string, number>>((a, x) => { const n = ((classes ?? []) as any[]).find((c) => c.id === x.class_id)?.name ?? "Nespecificată"; a[n] = (a[n] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]),
  };

  // proiecte
  const [{ data: pr }, { data: tasks }, { data: acts }] = await Promise.all([
    supabase.from("projects").select("id,title,status,category,starts_on,ends_on").eq("school_year_id", yearId),
    supabase.from("tasks").select("project_id,status").not("project_id", "is", null),
    supabase.from("activities").select("id,title,status,starts_at").eq("school_year_id", yearId),
  ]);
  const projects = ((pr ?? []) as any[]).map((p) => { const t = ((tasks ?? []) as any[]).filter((x) => x.project_id === p.id); return { ...p, done: t.filter((x) => x.status === "finalizat").length, tasks: t.length, progress: t.length ? Math.round((100 * t.filter((x) => x.status === "finalizat").length) / t.length) : p.status === "finalizat" ? 100 : 0 }; });
  const pc = (s: string) => projects.filter((p) => p.status === s).length;
  const projectStats = { total: projects.length, running: pc("in_desfasurare"), finished: pc("finalizat"), suspended: pc("suspendat"), prep: pc("in_pregatire") + pc("aprobat"), cancelled: pc("anulat"),
    list: projects, activities: { total: (acts ?? []).length, done: ((acts ?? []) as any[]).filter((a) => a.status === "finalizata").length, running: ((acts ?? []) as any[]).filter((a) => a.status === "in_desfasurare").length } };

  return { meetings: meetingStats, meetingRows: meetings, representatives, byClass, votes: voteStats, feedback: feedbackStats, projects: projectStats, activeReps: ((reps ?? []) as any[]).filter((r) => r.status === "active").length, classes: (classes ?? []) as { id: string; name: string }[] };
}
export type Stats = Awaited<ReturnType<typeof loadStats>>;

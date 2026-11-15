import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, nameMap } from "@/lib/data";
import { Badge, Card, DemoBadge, EmptyState, PageHeader, ProgressBar, Table, Td, Th } from "@/components/ui";
import { ActivityFormButton, ActivityStatusActions, ProjectFormButton } from "@/components/project-controls";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ACTIVITY_STATUS_LABEL, PROJECT_CATEGORY_LABEL, PROJECT_STATUS_LABEL } from "@/lib/labels";
import { PROJECT_TONE } from "@/lib/tones";
import { formatDateShort, formatDateTime } from "@/lib/format";
import type { Activity, Project } from "@/lib/types";

export const metadata = { title: "Proiecte și activități" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; stare?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "activitati" ? "activitati" : "proiecte";
  const s = await requireSession();
  const supabase = await createClient();
  const [{ data: pr }, { data: ac }, { data: tasks }, members] = await Promise.all([
    supabase.from("projects").select("*").eq("school_year_id", s.year?.id ?? "").order("created_at", { ascending: false }),
    supabase.from("activities").select("*").eq("school_year_id", s.year?.id ?? "").order("starts_at", { ascending: false }),
    supabase.from("tasks").select("project_id,status").not("project_id", "is", null),
    getMembers(supabase),
  ]);
  const prog = new Map<string, { done: number; total: number }>();
  for (const t of (tasks ?? []) as any[]) { const p = prog.get(t.project_id) ?? { done: 0, total: 0 }; p.total++; if (t.status === "finalizat") p.done++; prog.set(t.project_id, p); }
  const projects = ((pr ?? []) as Project[]).filter((p) => !sp.stare || p.status === sp.stare);
  const activities = (ac ?? []) as Activity[];
  const names = nameMap(members);
  const canManage = s.can("manage_projects");
  return (
    <>
      <RealtimeRefresh tables={["projects", "tasks"]} />
      <PageHeader title="Proiecte și activități" description="Planifică, organizează și urmărește proiectele și activitățile Consiliului."
        actions={canManage && (tab === "proiecte" ? <ProjectFormButton members={members} canAssign /> : <ActivityFormButton members={members} />)} />
      <div className="mb-4 flex gap-1 border-b border-line">
        {[["proiecte", `Proiecte (${(pr ?? []).length})`], ["activitati", `Activități (${activities.length})`]].map(([k, l]) => (
          <Link key={k} href={`/proiecte?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link>))}
      </div>
      {tab === "proiecte" ? (
        projects.length === 0 ? <EmptyState icon={<FolderKanban className="h-8 w-8" />} title="Niciun proiect" description={canManage ? "Creează primul proiect: adaugă etape, sarcini și responsabili." : "Proiectele Consiliului vor apărea aici."} action={canManage ? <ProjectFormButton members={members} canAssign /> : undefined} /> :
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const g = prog.get(p.id); const pctv = g?.total ? Math.round((100 * g.done) / g.total) : p.status === "finalizat" ? 100 : 0;
            return (
              <Link key={p.id} href={`/proiecte/${p.id}`} className="block"><Card className="h-full p-5 transition hover:border-brand/40 hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2"><h2 className="font-semibold leading-snug">{p.title} {p.is_demo && <DemoBadge />}</h2><Badge tone={PROJECT_TONE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge></div>
                <p className="text-xs text-muted">{PROJECT_CATEGORY_LABEL[p.category]}{p.starts_on && ` · ${formatDateShort(p.starts_on)}`}{p.ends_on && ` – ${formatDateShort(p.ends_on)}`}</p>
                {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>}
                <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-muted"><span>Progres</span><span>{g ? `${g.done}/${g.total} sarcini` : "fără sarcini"} · {pctv}%</span></div><ProgressBar value={pctv} label={`Progres ${p.title}`} tone={p.status === "finalizat" ? "ok" : "brand"} /></div>
              </Card></Link>);
          })}
        </div>
      ) : (
        activities.length === 0 ? <EmptyState title="Nicio activitate" description={canManage ? "Înregistrează campanii, întâlniri, evenimente sau acțiuni de voluntariat." : "Activitățile punctuale vor apărea aici."} action={canManage ? <ActivityFormButton members={members} /> : undefined} /> :
        <Card><Table><thead><tr><Th>Activitatea</Th><Th>Data</Th><Th>Locația</Th><Th>Responsabil</Th><Th>Stadiul</Th><Th>Acțiuni</Th></tr></thead>
          <tbody>{activities.map((a) => {
            const canUpdate = canManage || a.responsible_id === s.userId;
            return (<tr key={a.id}>
              <Td><span className="font-medium">{a.title}</span> {a.is_demo && <DemoBadge />}{a.description && <div className="line-clamp-1 text-xs text-muted">{a.description}</div>}</Td>
              <Td className="whitespace-nowrap">{formatDateTime(a.starts_at)}</Td><Td>{a.location ?? "—"}</Td><Td>{a.responsible_id ? names[a.responsible_id] ?? "—" : "—"}</Td>
              <Td><Badge tone={a.status === "finalizata" ? "ok" : a.status === "anulata" ? "bad" : a.status === "in_desfasurare" ? "warn" : "brand"}>{ACTIVITY_STATUS_LABEL[a.status]}</Badge></Td>
              <Td>{canUpdate && <div className="flex flex-wrap items-center">{canManage && <ActivityFormButton members={members} v={a} />}<ActivityStatusActions id={a.id} status={a.status} canDelete={canManage} /></div>}</Td>
            </tr>);})}</tbody></Table></Card>)}
    </>
  );
}

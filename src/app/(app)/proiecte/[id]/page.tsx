import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, nameMap } from "@/lib/data";
import { Badge, Card, CardHeader, DemoBadge, PageHeader, ProgressBar, Table, Td, Th } from "@/components/ui";
import { DeleteProjectButton, ProjectFormButton, ProjectStatusSelect, TaskFormButton, TaskRowActions } from "@/components/project-controls";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { PROJECT_CATEGORY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import { PROJECT_TONE } from "@/lib/tones";
import { formatBytes, formatDateShort } from "@/lib/format";
import type { DocumentRow, Project, Task } from "@/lib/types";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Project;
  const [{ data: t }, { data: pm }, { data: docs }, members] = await Promise.all([
    supabase.from("tasks").select("*").eq("project_id", id).order("due_date", { nullsFirst: false }).order("created_at"),
    supabase.from("project_members").select("profile_id,role").eq("project_id", id),
    supabase.from("documents").select("*").eq("project_id", id),
    getMembers(supabase),
  ]);
  const tasks = (t ?? []) as Task[]; const names = nameMap(members);
  const leads = (pm ?? []).filter((m: any) => m.role === "responsabil").map((m: any) => m.profile_id as string);
  const team = (pm ?? []).filter((m: any) => m.role === "membru").map((m: any) => m.profile_id as string);
  const canManage = s.can("manage_projects");
  const isLead = leads.includes(s.userId);
  const done = tasks.filter((x) => x.status === "finalizat").length;
  const pctv = tasks.length ? Math.round((100 * done) / tasks.length) : p.status === "finalizat" ? 100 : 0;
  return (
    <>
      <RealtimeRefresh tables={["projects", "tasks"]} />
      <PageHeader title={<span className="flex flex-wrap items-center gap-2">{p.title} {p.is_demo && <DemoBadge />}</span>}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={PROJECT_TONE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge><Badge>{PROJECT_CATEGORY_LABEL[p.category]}</Badge></span>}
        actions={<><Link href="/proiecte" className="text-sm text-muted hover:text-ink">← Toate proiectele</Link>
          {(canManage || isLead) && <ProjectFormButton members={members} canAssign={canManage} v={{ ...p, leads, team }} />}{canManage && <DeleteProjectButton id={id} />}</>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5"><div className="mb-1 flex justify-between text-sm"><span className="font-medium">Progres</span><span className="tabular-nums text-muted">{done}/{tasks.length} finalizate · {pctv}%</span></div><ProgressBar value={pctv} label="Progresul proiectului" tone={pctv === 100 ? "ok" : "brand"} /></Card>
          <Card>
            <CardHeader title="Etape și sarcini" action={(canManage || isLead) && <TaskFormButton projectId={id} members={members} />} />
            {tasks.length === 0 ? <p className="p-5 text-sm text-muted">Nicio sarcină încă. Adaugă etape și termene pentru a urmări progresul.</p> :
              <Table><thead><tr><Th>Titlu</Th><Th>Tip</Th><Th>Responsabil</Th><Th>Termen</Th><Th>Stare</Th><Th>Acțiuni</Th></tr></thead>
                <tbody>{tasks.map((x) => {
                  const overdue = x.due_date && x.status !== "finalizat" && new Date(x.due_date) < new Date(new Date().toDateString());
                  return (<tr key={x.id}>
                    <Td className="font-medium">{x.title}{x.description && <div className="text-xs font-normal text-muted">{x.description}</div>}</Td>
                    <Td>{x.kind === "etapa" ? "Etapă" : "Sarcină"}</Td><Td>{x.assignee_id ? names[x.assignee_id] ?? "—" : "—"}</Td>
                    <Td className="whitespace-nowrap">{x.due_date ? formatDateShort(x.due_date) : "—"} {overdue && <Badge tone="bad">întârziat</Badge>}</Td>
                    <Td><Badge tone={x.status === "finalizat" ? "ok" : x.status === "in_lucru" ? "warn" : "neutral"}>{TASK_STATUS_LABEL[x.status]}</Badge></Td>
                    <Td>{(canManage || isLead || x.assignee_id === s.userId) && <TaskRowActions id={x.id} status={x.status} canDelete={canManage} />}</Td>
                  </tr>);})}</tbody></Table>}
          </Card>
          {(docs ?? []).length > 0 && <Card><CardHeader title="Documente" /><ul className="divide-y divide-line">{(docs as DocumentRow[]).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span className="truncate">{d.title} <span className="text-muted">{formatBytes(d.size_bytes)}</span></span>
              <a href={`/api/documente/${d.id}`} className="inline-flex items-center gap-1 text-brand hover:underline"><Download className="h-4 w-4" aria-hidden />Descarcă</a></li>))}</ul></Card>}
        </div>
        <div className="space-y-6">
          <Card className="space-y-3 p-5 text-sm">
            {p.description && <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Descriere</p><p className="mt-1 whitespace-pre-line">{p.description}</p></div>}
            {p.objectives && <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Obiective</p><p className="mt-1 whitespace-pre-line">{p.objectives}</p></div>}
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Perioada</p><p className="mt-1">{p.starts_on ? formatDateShort(p.starts_on) : "—"} – {p.ends_on ? formatDateShort(p.ends_on) : "—"}</p></div>
            {p.location && <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Locația</p><p className="mt-1">{p.location}</p></div>}
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Responsabili</p><p className="mt-1">{leads.map((l) => names[l]).filter(Boolean).join(", ") || "—"}</p></div>
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Echipa</p><p className="mt-1">{team.map((l) => names[l]).filter(Boolean).join(", ") || "—"}</p></div>
            {p.notes && <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Observații</p><p className="mt-1 whitespace-pre-line">{p.notes}</p></div>}
          </Card>
          {(canManage || isLead) && <Card className="space-y-2 p-5"><p className="text-sm font-medium">Schimbă stadiul</p><ProjectStatusSelect id={id} status={p.status} /></Card>}
        </div>
      </div>
    </>
  );
}

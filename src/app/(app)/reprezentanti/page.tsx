import Link from "next/link";
import { requirePresident } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { repParticipation } from "@/lib/stats";
import { Badge, Card, EmptyState, Input, PageHeader, ProgressBar, Table, Td, Th, Alert } from "@/components/ui";
import { MeasureButtons } from "@/components/measure-controls";
import { REP_STATUS_LABEL } from "@/lib/labels";

export const metadata = { title: "Managementul reprezentanților" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const s = await requirePresident();
  const supabase = await createClient();
  const [{ data: reps }, { data: measures }, part] = await Promise.all([
    supabase.from("representatives").select("id,full_name,status,classes(name)").eq("school_year_id", s.year?.id ?? "").order("full_name"),
    supabase.from("admin_measures").select("representative_id,kind"),
    repParticipation(supabase, s.year?.id),
  ]);
  const mc = new Map<string, Record<string, number>>();
  for (const m of (measures ?? []) as any[]) { const e = mc.get(m.representative_id) ?? {}; e[m.kind] = (e[m.kind] ?? 0) + 1; mc.set(m.representative_id, e); }
  const rows = ((reps ?? []) as any[]).filter((r) => !q || r.full_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Managementul reprezentanților" description="Urmărește activitatea fiecărui reprezentant și înregistrează măsuri administrative. Toate acțiunile sunt păstrate în jurnalul de activitate și nu pot fi șterse." />
      <div className="mb-4"><Alert tone="info">Măsurile se înregistrează pentru evidență. Ele nu înlocuiesc procedurile prevăzute de regulamentul Consiliului (de exemplu, o demitere propriu-zisă).</Alert></div>
      <form className="mb-4 max-w-sm" role="search"><Input name="q" defaultValue={q} placeholder="Caută reprezentant…" aria-label="Caută reprezentant" /></form>
      {rows.length === 0 ? <EmptyState title="Niciun reprezentant" description="Adaugă reprezentanți în pagina Adunarea Generală." /> : (
        <Card><Table>
          <thead><tr><Th>Reprezentant</Th><Th>Clasa</Th><Th>Participare</Th><Th>Măsuri</Th><Th>Acțiuni administrative</Th></tr></thead>
          <tbody>{rows.map((r) => { const p = part.get(r.id); const m = mc.get(r.id) ?? {};
            return (<tr key={r.id}>
              <Td><Link href={`/reprezentanti/${r.id}`} className="font-medium text-brand hover:underline">{r.full_name}</Link> {r.status !== "active" && <Badge tone="warn">{REP_STATUS_LABEL[r.status]}</Badge>}</Td>
              <Td>{r.classes?.name}</Td>
              <Td className="min-w-40">{p ? <div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={p.pct} label={`Participare ${r.full_name}`} tone={p.pct >= 75 ? "ok" : p.pct >= 50 ? "warn" : "bad"} /></div><span className="w-24 text-right text-xs tabular-nums">{p.present}/{p.held} · {p.pct}%</span></div> : <span className="text-muted">—</span>}</Td>
              <Td className="whitespace-nowrap text-xs">{(m.mustrare ?? 0) + (m.avertisment ?? 0) + (m.demitere ?? 0) === 0 ? "—" : <>{m.mustrare ? `${m.mustrare} mustrări ` : ""}{m.avertisment ? `${m.avertisment} avertismente ` : ""}{m.demitere ? `${m.demitere} proceduri` : ""}</>}</Td>
              <Td><MeasureButtons repId={r.id} name={r.full_name} /></Td></tr>); })}</tbody></Table></Card>)}
    </>
  );
}

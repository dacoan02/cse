import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Istoric și activitate" };
const PAGE = 50;
const ENTITIES: Record<string, string> = { meetings: "Ședințe", votes: "Voturi", projects: "Proiecte", announcements: "Anunțuri", representatives: "Reprezentanți", profiles: "Conturi", admin_measures: "Măsuri administrative", documents: "Documente", feedback_items: "Sesizări", attendance: "Prezență", tasks: "Sarcini", activities: "Activități" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requirePerm("view_audit");
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.pagina) || 1);
  let q = supabase.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.entitate) q = q.eq("entity_type", sp.entitate);
  if (sp.q) q = q.or(`summary.ilike.%${sp.q.replace(/[%,()]/g, "")}%,actor_name.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  if (sp.de_la) q = q.gte("created_at", sp.de_la); if (sp.pana_la) q = q.lte("created_at", sp.pana_la + "T23:59:59");
  const { data, count } = await q;
  const rows = (data ?? []) as any[]; const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const base = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "pagina") as [string, string][]);
  void s;
  return (
    <>
      <PageHeader title="Istoric și activitate" description="Jurnal administrativ înregistrat automat. Înregistrările nu pot fi modificate sau șterse de niciun utilizator." />
      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <Input name="q" placeholder="Caută în acțiuni sau după autor…" defaultValue={sp.q} aria-label="Caută" className="lg:col-span-2" />
        <Select name="entitate" defaultValue={sp.entitate ?? ""} aria-label="Tip element"><option value="">Toate elementele</option>{Object.entries(ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Input type="date" name="de_la" defaultValue={sp.de_la} aria-label="De la" /><div className="flex gap-2"><Input type="date" name="pana_la" defaultValue={sp.pana_la} aria-label="Până la" /><Button type="submit" variant="secondary">Filtrează</Button></div>
      </form>
      {rows.length === 0 ? <EmptyState title="Nicio înregistrare" description="Acțiunile administrative vor apărea aici automat." /> : (
        <Card><Table><thead><tr><Th>Data și ora</Th><Th>Utilizator</Th><Th>Acțiune</Th><Th>Element</Th><Th>Detalii</Th></tr></thead>
          <tbody>{rows.map((e) => (<tr key={e.id}><Td className="whitespace-nowrap text-xs">{formatDateTime(e.created_at)}</Td><Td>{e.actor_name ?? <span className="text-muted">Sistem</span>}</Td><Td className="font-mono text-xs">{e.action}</Td><Td>{ENTITIES[e.entity_type] ?? e.entity_type}</Td>
            <Td className="max-w-md text-sm">{e.summary}{e.details && <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer">Date tehnice</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">{JSON.stringify(e.details, null, 1)}</pre></details>}</Td></tr>))}</tbody></Table></Card>)}
      <div className="mt-4 flex items-center justify-between text-sm text-muted"><span>{count ?? 0} înregistrări · pagina {page} din {pages}</span>
        <span className="flex gap-2">{page > 1 && <Link className={buttonClass("secondary", "sm")} href={`/istoric?${new URLSearchParams([...base, ["pagina", String(page - 1)]])}`}>← Înapoi</Link>}{page < pages && <Link className={buttonClass("secondary", "sm")} href={`/istoric?${new URLSearchParams([...base, ["pagina", String(page + 1)]])}`}>Înainte →</Link>}</span></div>
    </>
  );
}

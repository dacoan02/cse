import Link from "next/link";
import { Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClasses } from "@/lib/data";
import { repParticipation } from "@/lib/stats";
import { Badge, Button, Card, EmptyState, PageHeader, Select, Input, Stat, Table, Td, Th } from "@/components/ui";
import { AddRepButton, ClassesButton, ImportButton, RepRowActions } from "@/components/assembly-controls";
import { REP_STATUS_LABEL, ATTENDANCE_LABEL } from "@/lib/labels";
import { ATTENDANCE_TONE } from "@/lib/tones";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export const metadata = { title: "Adunarea Generală" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; clasa?: string; stare?: string; sort?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  const canManage = s.can("manage_representatives");
  const classes = await getClasses(supabase, s.year?.id);

  type Row = { id: string; full_name: string; class_id: string; class_name: string; position: string; status: string; email: string | null; mandate_start: string; notes: string | null; profile_id: string | null; invited_at: string | null; is_demo?: boolean };
  let rows: Row[] = [];
  if (s.isLeadership) {
    const { data } = await supabase.from("representatives").select("*,classes(name)").eq("school_year_id", s.year?.id ?? "");
    rows = (data ?? []).map((r: any) => ({ ...r, class_name: r.classes?.name ?? "" }));
  } else {
    const { data } = await supabase.from("assembly_directory").select("*").eq("school_year_id", s.year?.id ?? "");
    rows = (data ?? []).map((r: any) => ({ ...r, email: null, notes: null, invited_at: null }));
  }
  const part = s.isLeadership ? await repParticipation(supabase, s.year?.id) : new Map();
  const activeCount = rows.filter((r) => r.status === "active").length;
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = rows
    .filter((r) => !q || r.full_name.toLowerCase().includes(q) || r.class_name.toLowerCase().includes(q))
    .filter((r) => !sp.clasa || r.class_id === sp.clasa)
    .filter((r) => !sp.stare || r.status === sp.stare)
    .sort((a, b) => sp.sort === "clasa" ? a.class_name.localeCompare(b.class_name, "ro", { numeric: true }) || a.full_name.localeCompare(b.full_name, "ro") : a.full_name.localeCompare(b.full_name, "ro"));
  const classCount = classes.map((c) => ({ ...c, count: rows.filter((r) => r.class_id === c.id && r.status === "active").length }));

  return (
    <>
      <RealtimeRefresh tables={["meetings"]} />
      <PageHeader title="Adunarea Generală" description={`${s.institution.council_name} · ${s.institution.name}${s.year ? ` · An școlar ${s.year.label}` : ""}`}
        actions={canManage && <><ClassesButton classes={classCount} /><ImportButton /><AddRepButton classes={classes} /></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Membri activi ai Adunării Generale" value={activeCount} hint="Calculat automat din mandatele active" icon={<Users className="h-4 w-4" />} />
        <Stat label="Clase reprezentate" value={new Set(rows.filter((r) => r.status === "active").map((r) => r.class_id)).size} hint={`din ${classes.length} clase`} />
        <Stat label="Prag de cvorum" value={Math.floor(activeCount / 2) + 1} hint="⌊activi / 2⌋ + 1" />
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-48 flex-1"><label className="mb-1 block text-xs font-medium text-muted" htmlFor="q">Caută</label><Input id="q" name="q" defaultValue={sp.q} placeholder="Nume sau clasă…" /></div>
        <div><label className="mb-1 block text-xs font-medium text-muted" htmlFor="clasa">Clasa</label>
          <Select id="clasa" name="clasa" defaultValue={sp.clasa ?? ""}><option value="">Toate</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        {s.isLeadership && <div><label className="mb-1 block text-xs font-medium text-muted" htmlFor="stare">Statut</label>
          <Select id="stare" name="stare" defaultValue={sp.stare ?? ""}><option value="">Toate</option>{Object.entries(REP_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>}
        <div><label className="mb-1 block text-xs font-medium text-muted" htmlFor="sort">Sortare</label>
          <Select id="sort" name="sort" defaultValue={sp.sort ?? "nume"}><option value="nume">Alfabetic</option><option value="clasa">După clasă</option></Select></div>
        <Button type="submit" variant="secondary">Aplică</Button>
        {(sp.q || sp.clasa || sp.stare) && <Link href="/adunarea-generala" className="py-2 text-sm text-brand hover:underline">Resetează</Link>}
      </form>
      {filtered.length === 0 ? <EmptyState icon={<Users className="h-8 w-8" />} title={rows.length ? "Niciun rezultat" : "Adunarea Generală este goală"}
        description={rows.length ? "Încearcă alte criterii de căutare." : canManage ? "Adaugă clasele și reprezentanții sau importă o listă din Excel/CSV." : "Lista reprezentanților va apărea aici."}
        action={canManage && !rows.length ? <AddRepButton classes={classes} /> : undefined} /> : (
        <Card>
          <Table>
            <thead><tr><Th>Nr.</Th><Th>Nume și prenume</Th><Th>Clasa</Th><Th>Funcția</Th>{s.isLeadership && <><Th>Cont</Th><Th>Ultima ședință</Th><Th>Ședințe participate</Th></>}{canManage && <Th>Acțiuni</Th>}</tr></thead>
            <tbody>
              {filtered.map((r, i) => {
                const p = part.get(r.id);
                return (
                  <tr key={r.id} className={r.status !== "active" ? "opacity-70" : ""}>
                    <Td className="tabular-nums text-muted">{i + 1}</Td>
                    <Td className="font-medium">{s.isPresident ? <Link href={`/reprezentanti/${r.id}`} className="text-brand hover:underline">{r.full_name}</Link> : r.full_name} {r.is_demo && <Badge tone="warn">DEMO</Badge>}</Td>
                    <Td>{r.class_name}</Td><Td>{r.position}</Td>
                    {s.isLeadership && <>
                      <Td><div className="flex flex-col gap-1"><Badge tone={r.status === "active" ? "ok" : r.status === "inactive" ? "warn" : "bad"}>{REP_STATUS_LABEL[r.status]}</Badge>
                        <span className="text-xs text-muted">{r.profile_id ? "Cont creat" : r.invited_at ? "Invitat" : "Fără cont"}</span></div></Td>
                      <Td>{p?.lastStatus ? <Badge tone={ATTENDANCE_TONE[p.lastStatus]}>{ATTENDANCE_LABEL[p.lastStatus]}</Badge> : <span className="text-muted">—</span>}</Td>
                      <Td className="tabular-nums">{p ? `${p.present} din ${p.held}` : "0"}</Td>
                    </>}
                    {canManage && <Td><RepRowActions rep={r} classes={classes} canInvite={s.isPresident || s.can("manage_representatives")} /></Td>}
                  </tr>);
              })}
            </tbody>
          </Table>
        </Card>)}
    </>
  );
}

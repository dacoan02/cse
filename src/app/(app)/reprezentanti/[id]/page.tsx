import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePresident } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, nameMap } from "@/lib/data";
import { repParticipation } from "@/lib/stats";
import { Badge, Card, CardHeader, PageHeader, ProgressBar, Stat, Table, Td, Th } from "@/components/ui";
import { MeasureButtons, ProcedureEditor } from "@/components/measure-controls";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, MEASURE_LABEL, PROCEDURE_LABEL, REP_STATUS_LABEL } from "@/lib/labels";
import { FEEDBACK_TONE } from "@/lib/tones";
import { formatDate, formatDateShort, formatDateTime } from "@/lib/format";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePresident();
  const supabase = await createClient();
  const { data: r } = await supabase.from("representatives").select("*,classes(name)").eq("id", id).maybeSingle();
  if (!r) notFound();
  const [part, { data: measures }, members, { data: fb }, { count: organized }] = await Promise.all([
    repParticipation(supabase, s.year?.id),
    supabase.from("admin_measures").select("*").eq("representative_id", id).order("created_at", { ascending: false }),
    getMembers(supabase),
    r.profile_id ? supabase.from("feedback_items").select("id,title,kind,status,created_at").eq("author_id", r.profile_id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("school_year_id", s.year?.id ?? "").eq("status", "held").gte("starts_at", r.mandate_start),
  ]);
  const p = part.get(id) ?? { held: 0, present: 0, absent: 0, noResponse: 0, pct: 0 };
  const names = nameMap(members);
  return (
    <>
      <PageHeader title={r.full_name} description={<span className="flex flex-wrap items-center gap-2">Clasa {r.classes?.name} · {r.position} · mandat din {formatDate(r.mandate_start)}<Badge tone={r.status === "active" ? "ok" : "warn"}>{REP_STATUS_LABEL[r.status]}</Badge></span>}
        actions={<><Link href="/reprezentanti" className="text-sm text-muted hover:text-ink">← Toți reprezentanții</Link><MeasureButtons repId={id} name={r.full_name} /></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Ședințe organizate în mandat" value={organized ?? 0} /><Stat label="La care a participat" value={p.present} /><Stat label="Absențe declarate" value={p.absent} /><Stat label="Fără răspuns" value={p.noResponse} />
        <Stat label="Participare personală" value={p.held ? `${p.pct}%` : "—"} hint={`din ${p.held} ședințe la care a fost convocat`} />
      </div>
      <div className="mb-6"><ProgressBar value={p.pct} label="Participare personală" tone={p.pct >= 75 ? "ok" : p.pct >= 50 ? "warn" : "bad"} /></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Istoricul măsurilor administrative" subtitle="Păstrat permanent; nu poate fi șters." />
          <ul className="divide-y divide-line">{(measures ?? []).length === 0 && <li className="p-5 text-sm text-muted">Nicio măsură înregistrată.</li>}
            {(measures ?? []).map((m: any) => (<li key={m.id} className="space-y-1 px-5 py-3 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{MEASURE_LABEL[m.kind]}</span><span className="text-xs text-muted">{formatDateShort(m.applied_on)}</span></div>
              <p>{m.reason}</p>{m.description && <p className="text-muted">{m.description}</p>}
              {m.procedure_status && <p className="flex items-center gap-2"><Badge tone={m.procedure_status === "finalizata" ? "ok" : m.procedure_status === "respinsa" ? "neutral" : "warn"}>{PROCEDURE_LABEL[m.procedure_status]}</Badge><ProcedureEditor id={m.id} status={m.procedure_status} notes={m.notes} /></p>}
              {m.notes && <p className="text-xs text-muted">Observații: {m.notes}</p>}
              <p className="text-xs text-muted">Înregistrat de {m.created_by ? names[m.created_by] ?? "—" : "—"} · {formatDateTime(m.created_at)}</p></li>))}</ul></Card>
        <Card><CardHeader title="Propuneri și sesizări transmise" />
          {(fb ?? []).length === 0 ? <p className="p-5 text-sm text-muted">Nicio propunere trimisă.</p> :
            <Table><thead><tr><Th>Mesaj</Th><Th>Tip</Th><Th>Stare</Th></tr></thead><tbody>{(fb ?? []).map((f: any) => <tr key={f.id}><Td><Link href={`/vocea-reprezentantilor/${f.id}`} className="text-brand hover:underline">{f.title}</Link></Td><Td>{FEEDBACK_KIND_LABEL[f.kind]}</Td><Td><Badge tone={FEEDBACK_TONE[f.status]}>{FEEDBACK_STATUS_LABEL[f.status]}</Badge></Td></tr>)}</tbody></Table>}</Card>
      </div>
    </>
  );
}

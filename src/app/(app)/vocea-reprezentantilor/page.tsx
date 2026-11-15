import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClasses } from "@/lib/data";
import { Badge, Button, Card, DemoBadge, EmptyState, Input, PageHeader, Select, Table, Td, Th, buttonClass } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, IMPORTANCE_LABEL } from "@/lib/labels";
import { FEEDBACK_TONE, IMPORTANCE_TONE } from "@/lib/tones";
import { formatDateShort } from "@/lib/format";

export const metadata = { title: "Vocea reprezentanților" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  const seesAll = s.can("view_feedback");
  const classes = await getClasses(supabase, s.year?.id);
  let q = supabase.from("feedback_items").select("*").order("created_at", { ascending: false }).limit(300);
  if (!seesAll) q = q.eq("author_id", s.userId);
  if (sp.tip) q = q.eq("kind", sp.tip);
  if (sp.clasa) q = q.eq("class_id", sp.clasa);
  if (sp.importanta) q = q.eq("importance", sp.importanta);
  if (sp.stare) q = q.eq("status", sp.stare);
  if (sp.de_la) q = q.gte("created_at", sp.de_la);
  if (sp.pana_la) q = q.lte("created_at", sp.pana_la + "T23:59:59");
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const clsName = Object.fromEntries(classes.map((c) => [c.id, c.name]));
  const canSend = s.profile.role === "reprezentant";
  const filtered = Boolean(sp.tip || sp.clasa || sp.importanta || sp.stare || sp.de_la || sp.pana_la);
  return (
    <>
      <RealtimeRefresh tables={["feedback_items"]} />
      <PageHeader title="Vocea reprezentanților" description={seesAll ? "Toate sesizările și propunerile primite, cu arhiva lor." : "Mesajele trimise de tine și stadiul lor."}
        actions={canSend && <Link href="/vocea-reprezentantilor/nou" className={buttonClass()}>Transmite o problemă sau o propunere</Link>} />
      <form className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6" role="search">
        <Select name="tip" aria-label="Tip" defaultValue={sp.tip ?? ""}><option value="">Toate tipurile</option>{Object.entries(FEEDBACK_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        {seesAll && <Select name="clasa" aria-label="Clasa" defaultValue={sp.clasa ?? ""}><option value="">Toate clasele</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
        <Select name="importanta" aria-label="Importanță" defaultValue={sp.importanta ?? ""}><option value="">Orice importanță</option>{Object.entries(IMPORTANCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select name="stare" aria-label="Stare" defaultValue={sp.stare ?? ""}><option value="">Toate stările</option>{Object.entries(FEEDBACK_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Input type="date" name="de_la" aria-label="De la data" defaultValue={sp.de_la} />
        <div className="flex gap-2"><Input type="date" name="pana_la" aria-label="Până la data" defaultValue={sp.pana_la} /><Button type="submit" variant="secondary">Filtrează</Button></div>
      </form>
      {rows.length === 0 ? <EmptyState icon={<MessageSquareText className="h-8 w-8" />} title={filtered ? "Niciun rezultat pentru filtrele alese" : "Nu există mesaje"}
        description={canSend ? "Ai o problemă în clasă sau o idee pentru școală? Transmite-o conducerii Consiliului." : "Sesizările și propunerile reprezentanților vor apărea aici."}
        action={canSend && !filtered ? <Link href="/vocea-reprezentantilor/nou" className={buttonClass()}>Transmite o problemă sau o propunere</Link> : undefined} /> : (
        <Card><Table>
          <thead><tr><Th>Mesaj</Th><Th>Tip</Th><Th>Clasa</Th><Th>Importanță</Th><Th>Stare</Th><Th>Data</Th></tr></thead>
          <tbody>{rows.map((f) => (
            <tr key={f.id} className="hover:bg-surface2/50">
              <Td><Link href={`/vocea-reprezentantilor/${f.id}`} className="font-medium text-brand hover:underline">{f.title}</Link> {f.is_demo && <DemoBadge />}</Td>
              <Td>{FEEDBACK_KIND_LABEL[f.kind]}</Td><Td>{clsName[f.class_id] ?? "—"}</Td>
              <Td><Badge tone={IMPORTANCE_TONE[f.importance]}>{IMPORTANCE_LABEL[f.importance]}</Badge></Td>
              <Td><Badge tone={FEEDBACK_TONE[f.status]}>{FEEDBACK_STATUS_LABEL[f.status]}</Badge></Td>
              <Td className="whitespace-nowrap">{formatDateShort(f.created_at)}</Td>
            </tr>))}</tbody></Table></Card>)}
    </>
  );
}

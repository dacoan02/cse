import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, DemoBadge, EmptyState, PageHeader, buttonClass, Table, Td, Th, QuorumBadge } from "@/components/ui";
import { MEETING_STATUS_LABEL, MEETING_TYPE_LABEL, MODE_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { MEETING_TONE } from "@/lib/tones";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import type { Meeting } from "@/lib/types";

export const metadata = { title: "Ședințe" };
const TABS = [
  { key: "viitoare", label: "Viitoare" }, { key: "desfasurate", label: "Desfășurate" }, { key: "anulate", label: "Anulate" },
  { key: "ciorne", label: "Ciorne", leadership: true }, { key: "arhiva", label: "Arhivă" },
];


export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "viitoare" } = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  let q = supabase.from("meetings").select("*").order("starts_at", { ascending: tab === "viitoare" });
  if (tab === "viitoare") q = q.in("status", ["published", "in_progress"]).eq("archived", false);
  else if (tab === "desfasurate") q = q.eq("status", "held").eq("archived", false);
  else if (tab === "anulate") q = q.eq("status", "cancelled").eq("archived", false);
  else if (tab === "ciorne") q = q.eq("status", "draft");
  else q = q.eq("archived", true);
  const { data } = await q;
  const rows = (data ?? []) as Meeting[];
  return (
    <>
      <RealtimeRefresh tables={["meetings"]} />
      <PageHeader title="Ședințe" description="Programarea, convocarea și arhiva ședințelor Adunării Generale."
        actions={s.can("manage_meetings") && <Link href="/sedinte/nou" className={buttonClass()}>Programează o ședință</Link>} />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line" role="tablist">
        {TABS.filter((t) => !t.leadership || s.isLeadership).map((t) => (
          <Link key={t.key} href={`/sedinte?tab=${t.key}`} role="tab" aria-selected={tab === t.key}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>{t.label}</Link>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="Nicio ședință în această secțiune"
        description={s.can("manage_meetings") && tab === "viitoare" ? "Programează prima ședință: participanții vor fi notificați automat la publicare." : "Ședințele la care ești convocat vor apărea aici."}
        action={s.can("manage_meetings") && tab === "viitoare" ? <Link href="/sedinte/nou" className={buttonClass()}>Programează o ședință</Link> : undefined} /> : (
        <Card>
          <Table>
            <thead><tr><Th>Ședința</Th><Th>Data și ora</Th><Th>Tip</Th><Th>Stare</Th>{s.canFollow && <Th>Cvorum</Th>}</tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-surface2/50">
                  <Td><Link href={`/sedinte/${m.id}`} className="font-medium text-brand hover:underline">{m.title}</Link> {m.is_demo && <DemoBadge />}
                    <div className="text-xs text-muted">{m.location ?? "Locație nespecificată"} · {MODE_LABEL[m.mode]}</div></Td>
                  <Td>{formatDateTime(m.starts_at)}</Td>
                  <Td>{MEETING_TYPE_LABEL[m.meeting_type]}</Td>
                  <Td><Badge tone={MEETING_TONE[m.status]}>{MEETING_STATUS_LABEL[m.status]}</Badge></Td>
                  {s.canFollow && <Td>{m.status === "draft" || m.status === "cancelled" ? "—" : <div className="space-y-1"><QuorumBadge met={m.q_met} /><div className="text-xs text-muted">{m.q_present}/{m.q_required} necesari · {m.q_total} reprezentanți</div></div>}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}

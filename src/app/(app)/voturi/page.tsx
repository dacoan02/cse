import Link from "next/link";
import { Vote as VoteIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers } from "@/lib/data";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, DemoBadge } from "@/components/ui";
import { CreateVoteButton } from "@/components/vote-form";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { VOTE_STATUS_LABEL, VOTE_TYPE_LABEL, ROLE_LABEL } from "@/lib/labels";
import { VOTE_TONE } from "@/lib/tones";
import { formatDateTime } from "@/lib/format";
import type { Vote } from "@/lib/types";

export const metadata = { title: "Voturi și decizii" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "active" } = await searchParams;
  const s = await requireSession();
  const supabase = await createClient();
  await supabase.rpc("run_scheduled_jobs"); // deschide/închide voturile după termen
  const [{ data }, { data: mine }, members, { data: meetings }] = await Promise.all([
    supabase.from("votes").select("*").order("starts_at", { ascending: false }),
    supabase.from("vote_participation").select("vote_id").eq("profile_id", s.userId),
    s.can("manage_votes") ? getMembers(supabase) : Promise.resolve([]),
    s.can("manage_votes") ? supabase.from("meetings").select("id,title").neq("status", "cancelled").order("starts_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
  ]);
  const voted = new Set((mine ?? []).map((r: any) => r.vote_id));
  const all = (data ?? []) as Vote[];
  const rows = all.filter((v) => (tab === "active" ? ["deschis", "programat", "draft"].includes(v.status) : v.status === "inchis"));
  return (
    <>
      <RealtimeRefresh tables={["votes", "vote_participation"]} />
      <PageHeader title="Voturi și decizii" description="Votează în Adunarea Generală sau în grupuri de lucru autorizate. Fiecare persoană poate vota o singură dată."
        actions={s.can("manage_votes") && <CreateVoteButton members={members.map((m) => ({ id: m.id, name: m.full_name, role: ROLE_LABEL[m.role] }))} meetings={(meetings ?? []) as any} />} />
      <div className="mb-4 flex gap-1 border-b border-line">
        {[["active", "Active și programate"], ["arhiva", "Arhiva voturilor"]].map(([k, l]) => (
          <Link key={k} href={`/voturi?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState icon={<VoteIcon className="h-8 w-8" />} title={tab === "active" ? "Niciun vot activ" : "Arhiva este goală"} description="Voturile la care ai drept de participare vor apărea aici." /> :
        <Card><Table>
          <thead><tr><Th>Vot</Th><Th>Tip</Th><Th>Perioada</Th><Th>Stare</Th><Th>Participarea ta</Th></tr></thead>
          <tbody>{rows.map((v) => (
            <tr key={v.id} className="hover:bg-surface2/50">
              <Td><Link href={`/voturi/${v.id}`} className="font-medium text-brand hover:underline">{v.title}</Link> {v.is_demo && <DemoBadge />} {v.is_secret && <Badge>Secret</Badge>}
                <div className="line-clamp-1 text-xs text-muted">{v.question}</div></Td>
              <Td>{VOTE_TYPE_LABEL[v.vote_type]}</Td>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(v.starts_at)}<br />→ {formatDateTime(v.ends_at)}</Td>
              <Td><Badge tone={VOTE_TONE[v.status]}>{VOTE_STATUS_LABEL[v.status]}</Badge>{v.result?.outcome && <div className="mt-1 text-xs text-muted">{v.result.outcome}</div>}</Td>
              <Td>{voted.has(v.id) ? <Badge tone="ok">Ai votat</Badge> : v.status === "deschis" ? <Badge tone="warn">Nu ai votat încă</Badge> : "—"}</Td>
            </tr>))}
          </tbody></Table></Card>}
    </>
  );
}

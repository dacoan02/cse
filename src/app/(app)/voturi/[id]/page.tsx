import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, CardHeader, DemoBadge, PageHeader, ProgressBar, Stat, Table, Td, Th } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { ModalForm } from "@/components/modal";
import { Field, Textarea } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { VOTE_STATUS_LABEL, VOTE_TYPE_LABEL } from "@/lib/labels";
import { VOTE_TONE } from "@/lib/tones";
import { formatDateTime, pct } from "@/lib/format";
import { castVoteAction, closeVoteAction, saveVoteDecisionAction } from "@/app/actions/votes";
import type { Vote, VoteOption, VoteTally } from "@/lib/types";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const supabase = await createClient();
  await supabase.rpc("run_scheduled_jobs");
  const { data } = await supabase.from("votes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const v = data as Vote;
  const [{ data: opts }, { data: elig }, { data: part }, tallyR] = await Promise.all([
    supabase.from("vote_options").select("*").eq("vote_id", id).order("position"),
    supabase.from("vote_eligible").select("profile_id").eq("vote_id", id).eq("profile_id", s.userId),
    supabase.from("vote_participation").select("profile_id").eq("vote_id", id).eq("profile_id", s.userId),
    supabase.rpc("vote_tally", { p_vote: id }),
  ]);
  const options = (opts ?? []) as VoteOption[];
  const tally = tallyR.data as VoteTally | null;
  const eligible = (elig ?? []).length > 0;
  const hasVoted = (part ?? []).length > 0;
  const canVote = eligible && !hasVoted && v.status === "deschis";
  let choices: { voter: string; choice: string }[] = [];
  if (!v.is_secret && s.isLeadership && tally?.results_visible) {
    const r = await supabase.rpc("vote_public_choices", { p_vote: id });
    choices = (r.data ?? []) as any;
  }
  const total = tally ? tally.options.reduce((a, o) => a + o.count, 0) : 0;
  return (
    <>
      <RealtimeRefresh tables={["votes", "vote_participation"]} filter={{ votes: `id=eq.${id}` }} />
      <PageHeader title={<span className="flex flex-wrap items-center gap-2">{v.title} {v.is_demo && <DemoBadge />}</span>}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={VOTE_TONE[v.status]}>{VOTE_STATUS_LABEL[v.status]}</Badge><Badge>{VOTE_TYPE_LABEL[v.vote_type]}</Badge><Badge tone={v.is_secret ? "brand" : "neutral"}>{v.is_secret ? "Vot secret" : "Vot public"}</Badge></span>}
        actions={<>
          <Link href="/voturi" className="text-sm text-muted hover:text-ink">← Toate voturile</Link>
          {s.can("manage_votes") && v.status === "deschis" && <ConfirmAction action={closeVoteAction.bind(null, id)} title="Încheie votul acum" confirmLabel="Încheie votul" variant="danger"
            description="Votul se închide imediat, rezultatul se centralizează și participanții sunt notificați. Acțiunea nu poate fi anulată.">Încheie votul</ConfirmAction>}
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <p className="text-lg font-medium">{v.question}</p>
            {v.description && <p className="mt-2 whitespace-pre-line text-sm text-muted">{v.description}</p>}
            <p className="mt-3 text-xs text-muted">{formatDateTime(v.starts_at)} → {formatDateTime(v.ends_at)}</p>
          </Card>

          {canVote && (
            <Card>
              <CardHeader title="Votul tău" subtitle={v.is_secret ? "Alegerea ta rămâne confidențială. Nu poți modifica votul după trimitere." : "Votul este public pentru conducere. Nu poți modifica votul după trimitere."} />
              <ActionForm action={castVoteAction.bind(null, id)} successMessage="Votul tău a fost înregistrat." className="space-y-3 p-5">
                <fieldset className="space-y-2"><legend className="sr-only">Alege o opțiune</legend>
                  {options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm hover:bg-surface2 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                      <input type="radio" name="option" value={o.id} required className="h-4 w-4 accent-[var(--brand)]" />{o.label}
                    </label>))}
                </fieldset>
                <SubmitButton pendingLabel="Se trimite…">Trimite votul</SubmitButton>
              </ActionForm>
            </Card>)}
          {hasVoted && v.status === "deschis" && <Alert tone="success">Ai votat. Mulțumim pentru participare.</Alert>}
          {!eligible && !s.isLeadership && <Alert tone="info">Nu ai drept de vot în acest vot.</Alert>}
          {eligible === false && s.isLeadership && v.status === "deschis" && <Alert tone="info">Nu ești în lista persoanelor eligibile, dar poți urmări votul.</Alert>}
          {v.status === "programat" && <Alert tone="info">Votul începe pe {formatDateTime(v.starts_at)}.</Alert>}

          {tally && (
            <Card>
              <CardHeader title={v.status === "inchis" ? "Rezultatul final" : "Rezultate intermediare"} subtitle={v.status === "inchis" && tally.outcome ? tally.outcome : undefined} />
              {tally.results_visible ? (
                <div className="space-y-4 p-5">
                  {tally.options.map((o) => (
                    <div key={o.id}>
                      <div className="mb-1 flex justify-between text-sm"><span>{o.label}</span><span className="tabular-nums text-muted">{o.count} ({pct(o.count, total)}%)</span></div>
                      <ProgressBar value={pct(o.count, total)} label={o.label} />
                    </div>))}
                  {v.status === "inchis" && v.result && <p className="border-t border-line pt-3 text-sm font-semibold">Rezultat: {v.result.outcome}{!v.result.binding && " (consultativ)"}</p>}
                </div>
              ) : <p className="p-5 text-sm text-muted">Rezultatele vor fi afișate la încheierea votului.</p>}
            </Card>)}

          {choices.length > 0 && (
            <Card><CardHeader title="Voturi exprimate (vot public)" subtitle="Vizibil doar conducerii." />
              <Table><thead><tr><Th>Votant</Th><Th>Opțiune</Th></tr></thead><tbody>{choices.map((c, i) => <tr key={i}><Td>{c.voter}</Td><Td>{c.choice}</Td></tr>)}</tbody></Table></Card>)}

          {v.status === "inchis" && (v.decision_text || s.can("manage_votes")) && (
            <Card><CardHeader title="Decizia consemnată" action={s.can("manage_votes") && (
              <ModalForm trigger="Editează" triggerVariant="secondary" triggerSize="sm" title="Decizia consemnată" action={saveVoteDecisionAction.bind(null, id)}>
                <Field label="Text" htmlFor="decision_text"><Textarea id="decision_text" name="decision_text" rows={4} defaultValue={v.decision_text ?? ""} /></Field>
              </ModalForm>)} />
              <p className="whitespace-pre-line p-5 text-sm">{v.decision_text ?? <span className="text-muted">Nicio decizie consemnată.</span>}</p></Card>)}
        </div>
        <div className="space-y-4">
          {tally && <>
            <Stat label="Persoane eligibile" value={tally.eligible} />
            <Stat label="Au votat" value={tally.voted} hint={`${tally.participation_pct}% participare`} />
            <Stat label="Nu au votat" value={tally.not_voted} />
          </>}
        </div>
      </div>
    </>
  );
}

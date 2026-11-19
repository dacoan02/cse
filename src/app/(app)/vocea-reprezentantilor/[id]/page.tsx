import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireNotObserver } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, nameMap, getClasses } from "@/lib/data";
import { Badge, Card, CardHeader, DemoBadge, Field, PageHeader, Select, Textarea, Alert } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, IMPORTANCE_LABEL, ROLE_LABEL } from "@/lib/labels";
import { FEEDBACK_TONE, IMPORTANCE_TONE } from "@/lib/tones";
import { formatDateTime, formatBytes } from "@/lib/format";
import { addFeedbackNoteAction, manageFeedbackAction } from "@/app/actions/feedback";
import type { DocumentRow, FeedbackItem } from "@/lib/types";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireNotObserver();
  const supabase = await createClient();
  const { data } = await supabase.from("feedback_items").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const f = data as FeedbackItem;
  const canManage = s.can("manage_feedback") || f.assigned_to === s.userId;
  const [members, classes, { data: notes }, { data: docs }] = await Promise.all([
    getMembers(supabase), getClasses(supabase, s.year?.id),
    s.can("view_feedback") ? supabase.from("feedback_notes").select("*").eq("feedback_id", id).order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("documents").select("*").eq("feedback_id", id),
  ]);
  const names = nameMap(members);
  const cls = classes.find((c) => c.id === f.class_id)?.name;
  const leaders = members.filter((m) => m.role !== "reprezentant");
  const isAuthor = f.author_id === s.userId;
  return (
    <>
      <RealtimeRefresh tables={["feedback_items"]} filter={{ feedback_items: `id=eq.${id}` }} />
      <PageHeader title={<span className="flex flex-wrap items-center gap-2">{f.title} {f.is_demo && <DemoBadge />}</span>}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={FEEDBACK_TONE[f.status]}>{FEEDBACK_STATUS_LABEL[f.status]}</Badge><Badge>{FEEDBACK_KIND_LABEL[f.kind]}</Badge><Badge tone={IMPORTANCE_TONE[f.importance]}>Importanță: {IMPORTANCE_LABEL[f.importance]}</Badge></span>}
        actions={<Link href="/vocea-reprezentantilor" className="text-sm text-muted hover:text-ink">← Toate mesajele</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4 p-5 text-sm">
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Descrierea situației</p><p className="mt-1 whitespace-pre-line">{f.description}</p></div>
            {f.proposed_solution && <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Propunerea de soluționare</p><p className="mt-1 whitespace-pre-line">{f.proposed_solution}</p></div>}
            <p className="text-xs text-muted">Trimis de {names[f.author_id] ?? "—"}{cls ? ` · clasa ${cls}` : ""} · {formatDateTime(f.created_at)}</p>
          </Card>
          {(docs ?? []).length > 0 && <Card><CardHeader title="Fișiere atașate" />
            <ul className="divide-y divide-line">{(docs as DocumentRow[]).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span className="truncate">{d.file_name} <span className="text-muted">{formatBytes(d.size_bytes)}</span></span>
                <a href={`/api/documente/${d.id}`} className="inline-flex items-center gap-1 text-brand hover:underline"><Download className="h-4 w-4" aria-hidden />Descarcă</a></li>))}</ul></Card>}
          <Card>
            <CardHeader title="Răspuns oficial" />
            <div className="p-5 text-sm">{f.official_response ? <><p className="whitespace-pre-line">{f.official_response}</p>{f.responded_at && <p className="mt-2 text-xs text-muted">{formatDateTime(f.responded_at)}</p>}</> :
              <p className="text-muted">{isAuthor ? "Mesajul tău nu a primit încă un răspuns oficial. Vei fi notificat." : "Niciun răspuns oficial încă."}</p>}</div>
          </Card>
          {s.can("view_feedback") && <Card>
            <CardHeader title="Observații interne" subtitle="Vizibile doar conducerii autorizate." />
            <ul className="divide-y divide-line">{(notes ?? []).length === 0 && <li className="p-5 text-sm text-muted">Nicio observație.</li>}
              {(notes ?? []).map((n: any) => <li key={n.id} className="px-5 py-3 text-sm"><p className="whitespace-pre-line">{n.body}</p><p className="mt-1 text-xs text-muted">{names[n.author_id] ?? "—"} · {formatDateTime(n.created_at)}</p></li>)}</ul>
            {canManage && <ActionForm action={addFeedbackNoteAction.bind(null, id)} resetOnSuccess successMessage="Observația a fost adăugată." className="space-y-2 border-t border-line p-5">
              <Textarea name="body" rows={2} placeholder="Adaugă o observație internă…" required aria-label="Observație internă" /><SubmitButton>Adaugă observația</SubmitButton></ActionForm>}
          </Card>}
        </div>
        <div className="space-y-6">
          {canManage ? <Card>
            <CardHeader title="Administrare" />
            <ActionForm action={manageFeedbackAction.bind(null, id)} successMessage="Sesizarea a fost actualizată." className="space-y-4 p-5">
              <Field label="Starea" htmlFor="status"><Select id="status" name="status" defaultValue={f.status}>{Object.entries(FEEDBACK_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Responsabil" htmlFor="assigned_to"><Select id="assigned_to" name="assigned_to" defaultValue={f.assigned_to ?? ""}><option value="">— neatribuit —</option>{leaders.map((m) => <option key={m.id} value={m.id}>{m.full_name} · {ROLE_LABEL[m.role]}</option>)}</Select></Field>
              <Field label="Răspuns oficial" htmlFor="official_response" hint="Obligatoriu la „Soluționat” sau „Respins”."><Textarea id="official_response" name="official_response" rows={4} defaultValue={f.official_response ?? ""} /></Field>
              <SubmitButton className="w-full">Salvează</SubmitButton>
            </ActionForm>
          </Card> : <Card className="space-y-2 p-5 text-sm"><p className="font-medium">Stadiul mesajului</p><Badge tone={FEEDBACK_TONE[f.status]}>{FEEDBACK_STATUS_LABEL[f.status]}</Badge>
            {f.assigned_to && <p className="text-muted">Responsabil: {names[f.assigned_to] ?? "—"}</p>}</Card>}
          {!canManage && s.isLeadership && <Alert tone="info">Poți urmări această sesizare. Administrarea este rezervată președintelui sau persoanelor autorizate.</Alert>}
        </div>
      </div>
    </>
  );
}

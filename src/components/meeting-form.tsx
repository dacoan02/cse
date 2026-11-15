"use client";
import { useRef } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select, Textarea, Alert } from "@/components/ui";
import { RecipientPicker } from "@/components/recipient-picker";
import { saveMeetingAction } from "@/app/actions/meetings";

export interface MeetingFormValues {
  id?: string; title?: string; meeting_type?: string; starts_at?: string; expected_end_at?: string; location?: string; mode?: string;
  online_link?: string; reason?: string; description?: string; agenda?: string; status?: string;
}

export function MeetingForm({ values = {}, reps, leaders, selectedReps, selectedProfiles }: {
  values?: MeetingFormValues;
  reps: { id: string; name: string; cls: string; hasAccount: boolean }[];
  leaders: { id: string; name: string; roleLabel: string }[];
  selectedReps: string[]; selectedProfiles: string[];
}) {
  const intent = useRef<HTMLInputElement>(null);
  const isDraftOrNew = !values.id || values.status === "draft";
  return (
    <ActionForm action={saveMeetingAction} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="intent" ref={intent} defaultValue="draft" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titlul ședinței" htmlFor="title" required className="sm:col-span-2"><Input id="title" name="title" defaultValue={values.title} required maxLength={160} /></Field>
        <Field label="Tipul ședinței" htmlFor="meeting_type" required>
          <Select id="meeting_type" name="meeting_type" defaultValue={values.meeting_type ?? "ordinara"}><option value="ordinara">Ordinară</option><option value="extraordinara">Extraordinară</option></Select>
        </Field>
        <Field label="Tipul desfășurării" htmlFor="mode" required>
          <Select id="mode" name="mode" defaultValue={values.mode ?? "fizic"}><option value="fizic">Fizic</option><option value="online">Online</option><option value="hibrid">Hibrid</option></Select>
        </Field>
        <Field label="Data și ora începerii" htmlFor="starts_at" required hint="Selectează din calendar și din selectorul de oră."><Input id="starts_at" name="starts_at" type="datetime-local" defaultValue={values.starts_at} required /></Field>
        <Field label="Ora estimată de încheiere (opțional)" htmlFor="expected_end_at"><Input id="expected_end_at" name="expected_end_at" type="datetime-local" defaultValue={values.expected_end_at} /></Field>
        <Field label="Locația" htmlFor="location" hint="Sala sau spațiul în care se desfășoară ședința."><Input id="location" name="location" defaultValue={values.location} /></Field>
        <Field label="Link de participare online" htmlFor="online_link"><Input id="online_link" name="online_link" type="url" placeholder="https://…" defaultValue={values.online_link} /></Field>
        <Field label="Motivul convocării" htmlFor="reason" className="sm:col-span-2"><Textarea id="reason" name="reason" rows={2} defaultValue={values.reason} /></Field>
        <Field label="Descrierea ședinței" htmlFor="description" className="sm:col-span-2"><Textarea id="description" name="description" rows={3} defaultValue={values.description} /></Field>
        <Field label="Ordinea de zi" htmlFor="agenda" hint="Câte un punct pe fiecare rând." className="sm:col-span-2"><Textarea id="agenda" name="agenda" rows={5} defaultValue={values.agenda} /></Field>
      </div>
      <RecipientPicker reps={reps} leaders={leaders} selectedReps={selectedReps} selectedProfiles={selectedProfiles} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Convocator (PDF, DOCX etc.)" htmlFor="convocator" hint="Participanții îl pot descărca din pagina ședinței."><Input id="convocator" name="convocator" type="file" accept=".pdf,.doc,.docx,.odt,.txt" /></Field>
        <Field label="Alte documente anexate" htmlFor="attachments"><Input id="attachments" name="attachments" type="file" multiple /></Field>
      </div>
      {isDraftOrNew
        ? <Alert tone="info">Ciorna este vizibilă doar conducerii. Participanții primesc notificare abia la „Publică și notifică”.</Alert>
        : <Alert tone="info">Ședința este publicată: dacă schimbi data, ora sau locația, participanții primesc automat o notificare de actualizare.</Alert>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        {isDraftOrNew ? <>
          <SubmitButton variant="secondary" onClick={() => { if (intent.current) intent.current.value = "draft"; }}>Salvează ca ciornă</SubmitButton>
          <SubmitButton onClick={() => { if (intent.current) intent.current.value = "publish"; }}>Publică și notifică participanții</SubmitButton>
        </> : <SubmitButton onClick={() => { if (intent.current) intent.current.value = "draft"; }}>Salvează modificările</SubmitButton>}
      </div>
    </ActionForm>
  );
}

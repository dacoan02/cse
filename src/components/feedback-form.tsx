"use client";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { submitFeedbackAction } from "@/app/actions/feedback";
import { FEEDBACK_KIND_LABEL, IMPORTANCE_LABEL } from "@/lib/labels";
import type { ClassRow } from "@/lib/types";

export function FeedbackForm({ classes, defaultClass }: { classes: ClassRow[]; defaultClass: string }) {
  return (
    <ActionForm action={submitFeedbackAction} successMessage="Mesajul a fost trimis.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipul mesajului" htmlFor="kind" required><Select id="kind" name="kind" defaultValue="problema">{Object.entries(FEEDBACK_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Nivelul de importanță" htmlFor="importance" required><Select id="importance" name="importance" defaultValue="mediu">{Object.entries(IMPORTANCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Titlul mesajului" htmlFor="title" required className="sm:col-span-2"><Input id="title" name="title" maxLength={160} required /></Field>
        <Field label="Clasa vizată" htmlFor="class_id"><Select id="class_id" name="class_id" defaultValue={defaultClass}><option value="">— nespecificată —</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Fișiere atașate (opțional)" htmlFor="files"><Input id="files" name="files" type="file" multiple /></Field>
        <Field label="Descrierea situației" htmlFor="description" required className="sm:col-span-2"><Textarea id="description" name="description" rows={5} required /></Field>
        <Field label="Propunerea de soluționare" htmlFor="proposed_solution" className="sm:col-span-2"><Textarea id="proposed_solution" name="proposed_solution" rows={3} /></Field>
      </div>
      <div className="flex justify-end"><SubmitButton pendingLabel="Se trimite…">Trimite propunerea</SubmitButton></div>
    </ActionForm>
  );
}

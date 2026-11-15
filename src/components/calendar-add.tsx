"use client";
import { ModalForm } from "@/components/modal";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { addCalendarEventAction } from "@/app/actions/content";

export function AddCalendarEventButton() {
  return (
    <ModalForm trigger="Adaugă eveniment" title="Eveniment în calendar" action={addCalendarEventAction} submitLabel="Adaugă">
      <Field label="Titlu" htmlFor="ce-t" required><Input id="ce-t" name="title" required /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tip" htmlFor="ce-k"><Select id="ce-k" name="kind"><option value="eveniment">Eveniment</option><option value="termen_limita">Termen-limită</option><option value="altele">Altele</option></Select></Field>
        <Field label="Începe la" htmlFor="ce-s" required><Input id="ce-s" name="starts_at" type="datetime-local" required /></Field>
        <Field label="Se încheie la" htmlFor="ce-e"><Input id="ce-e" name="ends_at" type="datetime-local" /></Field>
      </div>
      <Field label="Descriere" htmlFor="ce-d"><Textarea id="ce-d" name="description" rows={2} /></Field>
    </ModalForm>
  );
}

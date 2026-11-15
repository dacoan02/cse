"use client";
import { ModalForm } from "@/components/modal";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { deleteDocumentAction, uploadDocumentAction } from "@/app/actions/content";
import { DOC_CATEGORY_LABEL } from "@/lib/labels";

export function UploadDocumentButton({ meetings }: { meetings: { id: string; title: string }[] }) {
  return (
    <ModalForm trigger="Încarcă document" title="Încarcă un document" description="PDF, Word, Excel, PowerPoint, imagini sau text (max. 15 MB)." action={uploadDocumentAction} submitLabel="Încarcă">
      <Field label="Titlu (opțional)" htmlFor="d-t" hint="Dacă lipsește, se folosește numele fișierului."><Input id="d-t" name="title" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria" htmlFor="d-c"><Select id="d-c" name="category" defaultValue="altele">{Object.entries(DOC_CATEGORY_LABEL).filter(([k]) => k !== "atasament").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Cine îl poate vedea" htmlFor="d-v"><Select id="d-v" name="visibility" defaultValue="toti"><option value="toti">Întreaga Adunare Generală</option><option value="conducere">Doar conducerea</option></Select></Field>
      </div>
      <Field label="Asociază unei ședințe (opțional)" htmlFor="d-m"><Select id="d-m" name="meeting_id" defaultValue=""><option value="">— nicio ședință —</option>{meetings.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</Select></Field>
      <Field label="Descriere" htmlFor="d-d"><Textarea id="d-d" name="description" rows={2} /></Field>
      <Field label="Fișiere" htmlFor="d-f" required><Input id="d-f" name="files" type="file" multiple required /></Field>
    </ModalForm>
  );
}
export function DeleteDocumentButton({ id, title }: { id: string; title: string }) {
  return <ConfirmAction size="sm" triggerVariant="ghost" action={deleteDocumentAction.bind(null, id)} title="Șterge documentul" description={`„${title}” va fi șters definitiv din arhivă.`} confirmLabel="Șterge">Șterge</ConfirmAction>;
}

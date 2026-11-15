"use client";
import Link from "next/link";
import { ConfirmAction } from "@/components/confirm-action";
import { ModalForm } from "@/components/modal";
import { Field, Textarea, Input, Select, Checkbox, buttonClass } from "@/components/ui";
import type { ClientActionResult } from "@/components/action-form";
import { DOC_CATEGORY_LABEL } from "@/lib/labels";

type Act = () => Promise<ClientActionResult>;
type FAct = (fd: FormData) => Promise<ClientActionResult>;

export function MeetingActions({ id, status, archived, canManage, publish, start, cancel, finish, remove, archive }: {
  id: string; status: string; archived: boolean; canManage: boolean; publish: Act; start: Act; cancel: FAct; finish: FAct; remove: Act; archive: Act;
}) {
  if (!canManage) return null;
  const open = status === "published" || status === "in_progress";
  return (
    <>
      {(status === "draft" || open) && <Link href={`/sedinte/${id}/editeaza`} className={buttonClass("secondary")}>Modifică</Link>}
      {status === "draft" && <ConfirmAction action={publish} variant="primary" triggerVariant="primary" title="Publică și notifică participanții"
        description="Ședința devine vizibilă, iar toți destinatarii selectați primesc o notificare cu detaliile și convocatorul." confirmLabel="Publică și notifică" successMessage="Ședința a fost publicată.">Publică și notifică</ConfirmAction>}
      {status === "published" && <ConfirmAction action={start} variant="primary" title="Începe ședința" description="Ședința va apărea ca „În desfășurare”. Prezența poate fi în continuare corectată de organizator." confirmLabel="Începe ședința">Începe ședința</ConfirmAction>}
      {open && <ModalForm trigger="Încheie ședința" triggerVariant="success" title="Marchează ședința drept desfășurată" description="Se salvează lista prezenților, a absenților și situația finală a cvorumului. După încheiere prezența nu mai poate fi modificată."
        action={finish} submitLabel="Marchează ca desfășurată" submitVariant="success">
        <Field label="Decizii adoptate (opțional)" htmlFor="decisions"><Textarea id="decisions" name="decisions" rows={4} /></Field>
      </ModalForm>}
      {(status === "draft" || open) && <ModalForm trigger="Anulează" triggerVariant="secondary" title="Anulează ședința" description="Participanții vor fi informați automat. Acțiunea nu poate fi anulată." action={cancel} submitLabel="Anulează ședința" submitVariant="danger">
        <Field label="Motivul anulării (opțional)" htmlFor="reason"><Textarea id="reason" name="reason" rows={3} /></Field>
      </ModalForm>}
      {status === "draft" && <ConfirmAction action={remove} title="Șterge ciorna" description="Ciorna va fi ștearsă definitiv." confirmLabel="Șterge ciorna">Șterge ciorna</ConfirmAction>}
      {(status === "held" || status === "cancelled") && <ConfirmAction action={archive} variant="primary" title={archived ? "Restaurează din arhivă" : "Arhivează ședința"} description={archived ? "Ședința revine în lista principală." : "Ședința va fi mutată în arhivă; informațiile rămân disponibile."} confirmLabel={archived ? "Restaurează" : "Arhivează"}>{archived ? "Restaurează" : "Arhivează"}</ConfirmAction>}
    </>
  );
}

export function AgendaEditor({ agenda, action, canNotify }: { agenda: string; action: FAct; canNotify: boolean }) {
  return (
    <ModalForm trigger="Editează ordinea de zi" triggerVariant="secondary" triggerSize="sm" title="Ordinea de zi" description="Un punct pe rând." action={action} successMessage="Ordinea de zi a fost salvată.">
      <Field label="Puncte" htmlFor="agenda"><Textarea id="agenda" name="agenda" rows={8} defaultValue={agenda} /></Field>
      {canNotify && <Checkbox name="notify" label="Notifică participanții că ordinea de zi a fost actualizată" />}
    </ModalForm>
  );
}

export function DocUploader({ action, secretaryPv }: { action: FAct; secretaryPv?: boolean }) {
  return (
    <ModalForm trigger="Încarcă document" triggerVariant="secondary" triggerSize="sm" title="Încarcă un document al ședinței" description="PDF, Word, Excel, PowerPoint, imagini (max. 15 MB)." action={action} submitLabel="Încarcă">
      <Field label="Titlu (opțional)" htmlFor="title"><Input id="title" name="title" /></Field>
      <Field label="Categorie" htmlFor="category">
        <Select id="category" name="category" defaultValue={secretaryPv ? "proces_verbal" : "altele"}>
          {["proces_verbal", "ordine_zi", "convocator", "hotarare", "raport", "altele"].map((k) => <option key={k} value={k}>{DOC_CATEGORY_LABEL[k]}</option>)}
        </Select>
      </Field>
      <Field label="Fișier" htmlFor="files" required><Input id="files" name="files" type="file" required /></Field>
    </ModalForm>
  );
}

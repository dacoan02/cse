"use client";
import { useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { ModalForm } from "@/components/modal";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { deleteAnnouncementAction, publishAnnouncementAction, togglePinAction } from "@/app/actions/content";
import { AUDIENCE_LABEL } from "@/lib/labels";

export function PublishAnnouncementButton({ members }: { members: { id: string; name: string; role: string }[] }) {
  const [aud, setAud] = useState("toti");
  return (
    <ModalForm wide trigger="Publică un anunț" title="Anunț nou" description="Destinatarii primesc o notificare în aplicație." action={publishAnnouncementAction} submitLabel="Publică și notifică">
      <Field label="Titlu" htmlFor="an-t" required><Input id="an-t" name="title" required maxLength={160} /></Field>
      <Field label="Conținut" htmlFor="an-c" required><Textarea id="an-c" name="content" rows={5} required /></Field>
      <Field label="Destinatari" htmlFor="an-a"><Select id="an-a" name="audience" value={aud} onChange={(e) => setAud(e.target.value)}>{Object.entries(AUDIENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      {aud === "selectie" && <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2">
        {members.map((m) => <Checkbox key={m.id} name="recipients" value={m.id} label={<>{m.name} <span className="text-muted">· {m.role}</span></>} />)}</div>}
      <Field label="Fișiere atașate (opțional)" htmlFor="an-f"><Input id="an-f" name="files" type="file" multiple /></Field>
      <Checkbox name="pinned" label="Fixează anunțul în partea de sus a paginii" />
    </ModalForm>
  );
}
export function AnnouncementActions({ id, pinned }: { id: string; pinned: boolean }) {
  return (
    <div className="flex gap-1">
      <ActionButton size="sm" variant="ghost" action={() => togglePinAction(id, !pinned)}>{pinned ? <><PinOff className="h-4 w-4" aria-hidden />Defixează</> : <><Pin className="h-4 w-4" aria-hidden />Fixează</>}</ActionButton>
      <ConfirmAction size="sm" triggerVariant="ghost" action={deleteAnnouncementAction.bind(null, id)} title="Șterge anunțul" description="Anunțul va dispărea pentru toți destinatarii." confirmLabel="Șterge">Șterge</ConfirmAction>
    </div>
  );
}

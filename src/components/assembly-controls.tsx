"use client";
import { useState } from "react";
import { ModalForm } from "@/components/modal";
import { ConfirmAction, ActionButton } from "@/components/confirm-action";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import * as A from "@/app/actions/assembly";
import type { ClassRow } from "@/lib/types";

export function RepFields({ classes, v }: { classes: ClassRow[]; v?: { full_name?: string; class_id?: string; position?: string; email?: string | null; mandate_start?: string; notes?: string | null } }) {
  return (
    <>
      <Field label="Nume și prenume" htmlFor="full_name" required><Input id="full_name" name="full_name" defaultValue={v?.full_name} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Clasa reprezentată" htmlFor="class_id" required hint="Un reprezentant aparține unei singure clase.">
          <Select id="class_id" name="class_id" defaultValue={v?.class_id ?? ""} required><option value="" disabled>Alege clasa…</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Funcția în Adunarea Generală" htmlFor="position"><Input id="position" name="position" defaultValue={v?.position ?? "Reprezentant"} /></Field>
        <Field label="E-mail (pentru cont)" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={v?.email ?? ""} /></Field>
        <Field label="Începutul mandatului" htmlFor="mandate_start"><Input id="mandate_start" name="mandate_start" type="date" defaultValue={v?.mandate_start ?? new Date().toISOString().slice(0, 10)} /></Field>
      </div>
      <Field label="Observații administrative" htmlFor="notes"><Textarea id="notes" name="notes" rows={2} defaultValue={v?.notes ?? ""} /></Field>
    </>
  );
}

export function AddRepButton({ classes }: { classes: ClassRow[] }) {
  return (
    <ModalForm trigger="Adaugă reprezentant" title="Adaugă un elev reprezentant" action={A.addRepresentativeAction} submitLabel="Adaugă" wide>
      {classes.length === 0 && <Alert tone="warn">Nu există clase. Adaugă mai întâi clasele din butonul „Clase”.</Alert>}
      <RepFields classes={classes} />
      <Checkbox name="invite" label="Creează contul de acces acum (necesită adresa de e-mail și parola de mai jos)" />
      <Field label="Parola inițială" htmlFor="rep-pw" hint="Minim 8 caractere. Reprezentantul o primește pe e-mail și o poate schimba din Setări."><Input id="rep-pw" name="password" type="text" autoComplete="off" minLength={8} /></Field>
    </ModalForm>
  );
}

export function ImportButton() {
  return (
    <ModalForm trigger="Importă din Excel/CSV" triggerVariant="secondary" title="Importă lista reprezentanților" action={A.importRepresentativesAction as never} submitLabel="Importă"
      description="Fișier .csv sau .xlsx cu antetul: Nume, Clasa, Funcția (opțional), E-mail (opțional), Început mandat (opțional, AAAA-LL-ZZ). Clasele lipsă se creează automat.">
      <Field label="Fișier" htmlFor="file" required><Input id="file" name="file" type="file" accept=".csv,.xlsx,.txt" required /></Field>
    </ModalForm>
  );
}

export function ClassesButton({ classes }: { classes: (ClassRow & { count: number })[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Clase ({classes.length})</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Structura claselor" description="Clasele anului școlar curent.">
        <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
          {classes.length === 0 && <li className="p-3 text-sm text-muted">Nicio clasă încă.</li>}
          {classes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>{c.name} <span className="text-muted">· {c.count} reprezentanți</span></span>
              <span className="flex gap-1">
                <ModalForm trigger="Redenumește" triggerVariant="ghost" triggerSize="sm" title={`Redenumește ${c.name}`} action={A.renameClassAction.bind(null, c.id)}>
                  <Field label="Denumire" htmlFor={`cn-${c.id}`}><Input id={`cn-${c.id}`} name="name" defaultValue={c.name} required /></Field>
                </ModalForm>
                <ConfirmAction size="sm" triggerVariant="ghost" action={A.deleteClassAction.bind(null, c.id)} title={`Șterge clasa ${c.name}`} description="Clasa poate fi ștearsă doar dacă nu are reprezentanți." confirmLabel="Șterge">Șterge</ConfirmAction>
              </span>
            </li>))}
        </ul>
        <ModalForm trigger="Adaugă clase" title="Adaugă clase" action={A.addClassAction} submitLabel="Adaugă">
          <Field label="Denumiri" htmlFor="names" hint="Separate prin virgulă sau pe rânduri. Ex.: IX A, IX B"><Textarea id="names" name="names" rows={3} required /></Field>
        </ModalForm>
      </Modal>
    </>
  );
}

export function RepRowActions({ rep, classes, canInvite }: {
  rep: { id: string; full_name: string; class_id: string; position: string; email: string | null; mandate_start: string; notes: string | null; status: string; profile_id: string | null };
  classes: ClassRow[]; canInvite: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <ModalForm trigger="Modifică" triggerVariant="ghost" triggerSize="sm" title={`Modifică: ${rep.full_name}`} wide action={A.updateRepresentativeAction.bind(null, rep.id)}
        description="Schimbarea clasei transferă reprezentantul; istoricul rămâne păstrat.">
        <RepFields classes={classes} v={rep} />
      </ModalForm>
      {canInvite && rep.status === "active" && rep.email && (
        <ModalForm trigger={rep.profile_id ? "Resetează parola" : "Creează cont"} triggerVariant="ghost" triggerSize="sm" title={`Acces pentru ${rep.full_name}`} submitLabel="Salvează și trimite e-mail"
          description={`Setează parola inițială. Datele de acces se trimit la ${rep.email}, iar reprezentantul își poate schimba parola din Setări.`} action={A.inviteRepresentativeAction.bind(null, rep.id)}>
          <Field label="Parola inițială" htmlFor={`pw-${rep.id}`} hint="Minim 8 caractere."><Input id={`pw-${rep.id}`} name="password" type="text" autoComplete="off" minLength={8} required /></Field>
        </ModalForm>
      )}
      {rep.status === "active"
        ? <>
            <ConfirmAction size="sm" triggerVariant="ghost" action={A.setRepresentativeStatusAction.bind(null, rep.id, "inactive")} title="Dezactivează contul" confirmLabel="Dezactivează" variant="danger"
              description={`${rep.full_name} nu va mai putea accesa aplicația și nu va mai conta la calculul cvorumului. Istoricul se păstrează.`}>Dezactivează</ConfirmAction>
            <ConfirmAction size="sm" triggerVariant="ghost" action={A.setRepresentativeStatusAction.bind(null, rep.id, "removed")} title="Elimină din structura activă" confirmLabel="Elimină" variant="danger"
              description={`${rep.full_name} este eliminat din Adunarea Generală. Participările și măsurile administrative rămân în istoric.`}>Elimină</ConfirmAction>
          </>
        : <ActionButton size="sm" variant="ghost" action={A.setRepresentativeStatusAction.bind(null, rep.id, "active")}>Reactivează</ActionButton>}
    </div>
  );
}

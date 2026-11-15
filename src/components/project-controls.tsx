"use client";
import { ModalForm } from "@/components/modal";
import { ConfirmAction, ActionButton } from "@/components/confirm-action";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { PROJECT_CATEGORY_LABEL, PROJECT_STATUS_LABEL, ACTIVITY_STATUS_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import * as P from "@/app/actions/projects";
import { isoToLocalInput } from "@/lib/format";

type Member = { id: string; full_name: string };
export interface ProjectValues { id?: string; title?: string; description?: string | null; objectives?: string | null; category?: string; starts_on?: string | null; ends_on?: string | null; location?: string | null; status?: string; notes?: string | null; leads?: string[]; team?: string[] }

export function ProjectFormButton({ members, v, canAssign }: { members: Member[]; v?: ProjectValues; canAssign: boolean }) {
  const edit = !!v?.id;
  return (
    <ModalForm wide trigger={edit ? "Modifică proiectul" : "Adaugă proiect"} triggerVariant={edit ? "secondary" : "primary"} title={edit ? "Modifică proiectul" : "Proiect nou"}
      action={P.saveProjectAction.bind(null, v?.id ?? null)} submitLabel={edit ? "Salvează" : "Creează proiectul"}>
      <Field label="Titlul proiectului" htmlFor="p-title" required><Input id="p-title" name="title" defaultValue={v?.title} required maxLength={160} /></Field>
      <Field label="Descrierea proiectului" htmlFor="p-desc"><Textarea id="p-desc" name="description" rows={3} defaultValue={v?.description ?? ""} /></Field>
      <Field label="Obiectivele proiectului" htmlFor="p-obj"><Textarea id="p-obj" name="objectives" rows={2} defaultValue={v?.objectives ?? ""} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Categoria" htmlFor="p-cat"><Select id="p-cat" name="category" defaultValue={v?.category ?? "educational"}>{Object.entries(PROJECT_CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Data începerii" htmlFor="p-s"><Input id="p-s" name="starts_on" type="date" defaultValue={v?.starts_on ?? ""} /></Field>
        <Field label="Data finalizării" htmlFor="p-e"><Input id="p-e" name="ends_on" type="date" defaultValue={v?.ends_on ?? ""} /></Field>
        <Field label="Locația" htmlFor="p-l"><Input id="p-l" name="location" defaultValue={v?.location ?? ""} /></Field>
        <Field label="Stadiul" htmlFor="p-st"><Select id="p-st" name="status" defaultValue={v?.status ?? "in_pregatire"}>{Object.entries(PROJECT_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      </div>
      {canAssign && <div className="grid gap-4 sm:grid-cols-2">
        <fieldset><legend className="mb-1 text-sm font-medium">Responsabili</legend><div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {members.map((m) => <Checkbox key={m.id} name="leads" value={m.id} defaultChecked={v?.leads?.includes(m.id)} label={m.full_name} />)}</div></fieldset>
        <fieldset><legend className="mb-1 text-sm font-medium">Membrii echipei</legend><div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {members.map((m) => <Checkbox key={m.id} name="team" value={m.id} defaultChecked={v?.team?.includes(m.id)} label={m.full_name} />)}</div></fieldset>
      </div>}
      {!edit && <Field label="Etapele proiectului" htmlFor="p-stages" hint="O etapă pe rând; termen opțional după bară: Pregătirea materialelor | 2026-12-01"><Textarea id="p-stages" name="stages" rows={3} /></Field>}
      <Field label="Observații" htmlFor="p-notes"><Textarea id="p-notes" name="notes" rows={2} defaultValue={v?.notes ?? ""} /></Field>
      <Field label="Documente atașate" htmlFor="p-files"><Input id="p-files" name="files" type="file" multiple /></Field>
    </ModalForm>
  );
}

export function ProjectStatusSelect({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(PROJECT_STATUS_LABEL).filter(([k]) => k !== status).map(([k, l]) => (
        <ActionButton key={k} size="sm" variant="secondary" action={() => P.setProjectStatusAction(id, k)}>→ {l}</ActionButton>))}
    </div>
  );
}

export function TaskFormButton({ projectId, members }: { projectId: string; members: Member[] }) {
  return (
    <ModalForm trigger="Adaugă sarcină / etapă" triggerSize="sm" title="Sarcină sau etapă" action={P.addTaskAction.bind(null, projectId)} submitLabel="Adaugă">
      <Field label="Titlu" htmlFor="t-title" required><Input id="t-title" name="title" required /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tip" htmlFor="t-kind"><Select id="t-kind" name="kind"><option value="sarcina">Sarcină</option><option value="etapa">Etapă</option></Select></Field>
        <Field label="Termen-limită" htmlFor="t-due"><Input id="t-due" name="due_date" type="date" /></Field>
        <Field label="Responsabil" htmlFor="t-as"><Select id="t-as" name="assignee_id" defaultValue=""><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select></Field>
      </div>
      <Field label="Descriere" htmlFor="t-d"><Textarea id="t-d" name="description" rows={2} /></Field>
    </ModalForm>
  );
}

export function TaskRowActions({ id, status, canDelete }: { id: string; status: string; canDelete: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Object.entries(TASK_STATUS_LABEL).filter(([k]) => k !== status).map(([k, l]) => <ActionButton key={k} size="sm" variant="ghost" action={() => P.setTaskStatusAction(id, k)}>{l}</ActionButton>)}
      {canDelete && <ConfirmAction size="sm" triggerVariant="ghost" action={P.deleteTaskAction.bind(null, id)} title="Șterge sarcina" description="Sarcina va fi ștearsă definitiv." confirmLabel="Șterge">Șterge</ConfirmAction>}
    </div>
  );
}

export function DeleteProjectButton({ id }: { id: string }) {
  return <ConfirmAction action={P.deleteProjectAction.bind(null, id)} title="Șterge proiectul" description="Proiectul, sarcinile și etapele lui vor fi șterse definitiv." confirmLabel="Șterge proiectul">Șterge</ConfirmAction>;
}

export function ActivityFormButton({ members, v }: { members: Member[]; v?: { id: string; title: string; description: string | null; starts_at: string; ends_at: string | null; location: string | null; responsible_id: string | null; status: string } }) {
  return (
    <ModalForm trigger={v ? "Modifică" : "Adaugă activitate"} triggerVariant={v ? "ghost" : "primary"} triggerSize={v ? "sm" : "md"} title={v ? "Modifică activitatea" : "Activitate nouă"}
      description="Activitățile apar automat în calendarul general." action={P.saveActivityAction.bind(null, v?.id ?? null)}>
      <Field label="Titlul activității" htmlFor="a-title" required><Input id="a-title" name="title" defaultValue={v?.title} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Începe la" htmlFor="a-s" required><Input id="a-s" name="starts_at" type="datetime-local" defaultValue={isoToLocalInput(v?.starts_at)} required /></Field>
        <Field label="Se încheie la" htmlFor="a-e"><Input id="a-e" name="ends_at" type="datetime-local" defaultValue={isoToLocalInput(v?.ends_at)} /></Field>
        <Field label="Locația" htmlFor="a-l"><Input id="a-l" name="location" defaultValue={v?.location ?? ""} /></Field>
        <Field label="Responsabil" htmlFor="a-r"><Select id="a-r" name="responsible_id" defaultValue={v?.responsible_id ?? ""}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</Select></Field>
      </div>
      {v && <Field label="Stadiul" htmlFor="a-st"><Select id="a-st" name="status" defaultValue={v.status}>{Object.entries(ACTIVITY_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>}
      <Field label="Descriere" htmlFor="a-d"><Textarea id="a-d" name="description" rows={2} defaultValue={v?.description ?? ""} /></Field>
    </ModalForm>
  );
}
export function ActivityStatusActions({ id, status, canDelete }: { id: string; status: string; canDelete: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Object.entries(ACTIVITY_STATUS_LABEL).filter(([k]) => k !== status).map(([k, l]) => <ActionButton key={k} size="sm" variant="ghost" action={() => P.setActivityStatusAction(id, k)}>{l}</ActionButton>)}
      {canDelete && <ConfirmAction size="sm" triggerVariant="ghost" action={P.deleteActivityAction.bind(null, id)} title="Șterge activitatea" description="Activitatea va fi ștearsă definitiv." confirmLabel="Șterge">Șterge</ConfirmAction>}
    </div>
  );
}

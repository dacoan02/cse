"use client";
import { ModalForm } from "@/components/modal";
import { Field, Input, Select, Textarea, Alert } from "@/components/ui";
import { addMeasureAction, updateProcedureAction } from "@/app/actions/measures";
import { PROCEDURE_LABEL } from "@/lib/labels";

const today = () => new Date().toISOString().slice(0, 10);

export function MeasureButtons({ repId, name }: { repId: string; name: string }) {
  const common = (kind: "mustrare" | "avertisment" | "demitere") => (
    <>
      {kind === "demitere" && <Alert tone="warn">Aici se înregistrează <strong>procedura</strong>, nu se încheie automat mandatul. Hotărârea finală se ia conform regulamentului; după aceea poți elimina reprezentantul din Adunarea Generală.</Alert>}
      <Field label={kind === "avertisment" ? "Motivul avertizării" : kind === "demitere" ? "Motivul demiterii" : "Motiv"} htmlFor={`m-${kind}-r`} required><Input id={`m-${kind}-r`} name="reason" required /></Field>
      <Field label="Descrierea situației" htmlFor={`m-${kind}-d`}><Textarea id={`m-${kind}-d`} name="description" rows={3} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={kind === "demitere" ? "Data deciziei" : "Data aplicării"} htmlFor={`m-${kind}-a`}><Input id={`m-${kind}-a`} name="applied_on" type="date" defaultValue={today()} /></Field>
        {kind === "demitere" && <Field label="Starea procedurii" htmlFor="m-dem-s"><Select id="m-dem-s" name="procedure_status" defaultValue="initiata">{Object.entries(PROCEDURE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>}
      </div>
      <Field label="Observații suplimentare" htmlFor={`m-${kind}-n`}><Textarea id={`m-${kind}-n`} name="notes" rows={2} /></Field>
      <Field label={kind === "mustrare" ? "Document (opțional)" : "Document justificativ"} htmlFor={`m-${kind}-f`}><Input id={`m-${kind}-f`} name="files" type="file" multiple /></Field>
    </>
  );
  return (
    <div className="flex flex-wrap gap-1">
      <ModalForm trigger="Mustrare" triggerVariant="ghost" triggerSize="sm" title={`Mustrare – ${name}`} action={addMeasureAction.bind(null, repId, "mustrare")} submitLabel="Înregistrează mustrarea">{common("mustrare")}</ModalForm>
      <ModalForm trigger="Avertisment" triggerVariant="ghost" triggerSize="sm" title={`Avertisment – ${name}`} action={addMeasureAction.bind(null, repId, "avertisment")} submitLabel="Înregistrează avertismentul">{common("avertisment")}</ModalForm>
      <ModalForm trigger="Demitere" triggerVariant="ghost" triggerSize="sm" title={`Procedură de demitere – ${name}`} action={addMeasureAction.bind(null, repId, "demitere")} submitLabel="Înregistrează procedura" submitVariant="danger">{common("demitere")}</ModalForm>
    </div>
  );
}
export function ProcedureEditor({ id, status, notes }: { id: string; status: string; notes: string | null }) {
  return (
    <ModalForm trigger="Actualizează procedura" triggerVariant="secondary" triggerSize="sm" title="Starea procedurii de demitere" action={updateProcedureAction.bind(null, id)}>
      <Field label="Starea procedurii" htmlFor="pe-s"><Select id="pe-s" name="procedure_status" defaultValue={status}>{Object.entries(PROCEDURE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      <Field label="Observații" htmlFor="pe-n"><Textarea id="pe-n" name="notes" rows={3} defaultValue={notes ?? ""} /></Field>
    </ModalForm>
  );
}

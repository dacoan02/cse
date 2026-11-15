"use client";
import { useState } from "react";
import { ModalForm } from "@/components/modal";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { createVoteAction } from "@/app/actions/votes";
import { VOTE_TYPE_LABEL } from "@/lib/labels";

export function CreateVoteButton({ members, meetings }: { members: { id: string; name: string; role: string }[]; meetings: { id: string; title: string }[] }) {
  const [type, setType] = useState("da_nu_abtinere");
  const [scope, setScope] = useState("reprezentanti");
  const needsOptions = type === "alegere_multipla" || type === "desemnare_persoana";
  return (
    <ModalForm wide trigger="Creează vot" title="Inițiază un vot" description="Participanții eligibili vor fi notificați imediat." action={createVoteAction} submitLabel="Creează votul">
      <Field label="Titlul votului" htmlFor="v-title" required><Input id="v-title" name="title" required maxLength={160} /></Field>
      <Field label="Întrebarea supusă votului" htmlFor="v-q" required><Textarea id="v-q" name="question" rows={2} required /></Field>
      <Field label="Descriere (opțional)" htmlFor="v-d"><Textarea id="v-d" name="description" rows={2} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipul votului" htmlFor="v-type">
          <Select id="v-type" name="vote_type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(VOTE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Ședința asociată (opțional)" htmlFor="v-m">
          <Select id="v-m" name="meeting_id" defaultValue=""><option value="">— fără —</option>{meetings.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</Select>
        </Field>
      </div>
      {needsOptions && <Field label={type === "desemnare_persoana" ? "Candidați (câte unul pe rând)" : "Variante (câte una pe rând)"} htmlFor="v-o" required><Textarea id="v-o" name="options" rows={4} required /></Field>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Începe la (gol = acum)" htmlFor="v-s"><Input id="v-s" name="starts_at" type="datetime-local" /></Field>
        <Field label="Se încheie la" htmlFor="v-e" required><Input id="v-e" name="ends_at" type="datetime-local" required /></Field>
      </div>
      <Field label="Cine are drept de vot" htmlFor="v-scope">
        <Select id="v-scope" name="eligible_scope" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="reprezentanti">Elevii reprezentanți activi</option><option value="conducere">Doar conducerea</option><option value="toti">Toți membrii</option><option value="selectie">Persoane selectate</option>
        </Select>
      </Field>
      {scope === "selectie" && <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2">
        {members.map((m) => <Checkbox key={m.id} name="eligible_ids" value={m.id} label={<>{m.name} <span className="text-muted">· {m.role}</span></>} />)}
      </div>}
      <div className="space-y-2 rounded-lg border border-line p-3">
        <Checkbox name="is_secret" label={<><strong>Vot secret</strong> – alegerea fiecărui votant rămâne confidențială, nici conducerea nu o poate vedea.</>} />
        <Checkbox name="show_interim" label="Afișează rezultatele intermediare în timpul votului" />
      </div>
    </ModalForm>
  );
}

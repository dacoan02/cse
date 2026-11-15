"use client";
import { useState } from "react";
import { Badge, Button, Checkbox } from "@/components/ui";

interface Rep { id: string; name: string; cls: string; hasAccount: boolean }
interface Leader { id: string; name: string; roleLabel: string }

/** Selectarea destinatarilor: întreaga Adunare printr-un singur buton, anumiți reprezentanți, conducerea. */
export function RecipientPicker({ reps, leaders, selectedReps, selectedProfiles }: {
  reps: Rep[]; leaders: Leader[]; selectedReps: string[]; selectedProfiles: string[];
}) {
  const [r, setR] = useState(new Set(selectedReps));
  const [p, setP] = useState(new Set(selectedProfiles));
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); };
  const total = r.size + p.size;
  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-medium">Destinatari <span className="font-normal text-muted">({total} selectați)</span></legend>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setR(new Set(reps.map((x) => x.id)))}>Toată Adunarea Generală</Button>
        <Button size="sm" variant="secondary" onClick={() => setP(new Set(leaders.map((x) => x.id)))}>Membrii conducerii</Button>
        <Button size="sm" variant="secondary" onClick={() => { setR(new Set(reps.map((x) => x.id))); setP(new Set(leaders.map((x) => x.id))); }}>Toți</Button>
        <Button size="sm" variant="ghost" onClick={() => { setR(new Set()); setP(new Set()); }}>Golește selecția</Button>
      </div>
      {leaders.length > 0 && <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Conducere</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {leaders.map((l) => <Checkbox key={l.id} name="profile_ids" value={l.id} checked={p.has(l.id)} onChange={() => toggle(p, setP, l.id)} label={<>{l.name} <span className="text-muted">· {l.roleLabel}</span></>} />)}
        </div>
      </div>}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Elevi reprezentanți</p>
        {reps.length === 0 ? <p className="text-sm text-muted">Nu există reprezentanți activi. Adaugă-i mai întâi în Adunarea Generală.</p> :
          <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {reps.map((x) => <Checkbox key={x.id} name="rep_ids" value={x.id} checked={r.has(x.id)} onChange={() => toggle(r, setR, x.id)}
              label={<>{x.name} <span className="text-muted">· {x.cls}</span> {!x.hasAccount && <Badge tone="warn">fără cont</Badge>}</>} />)}
          </div>}
      </div>
    </fieldset>
  );
}

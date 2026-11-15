"use client";
import { useState } from "react";
import { ModalForm, Modal } from "@/components/modal";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/toast";
import * as S from "@/app/actions/settings";
import { CONFIGURABLE_PERMS } from "@/lib/permissions";
import { hasPerm } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

export function InviteLeaderButton() {
  return (
    <ModalForm trigger="Invită un membru al conducerii" title="Cont nou pentru conducere" description="Persoana primește un e-mail pentru a-și seta parola. Drepturile suplimentare se configurează după invitație." action={S.inviteLeaderAction} submitLabel="Trimite invitația">
      <Field label="Nume și prenume" htmlFor="il-n" required><Input id="il-n" name="full_name" required /></Field>
      <Field label="Adresa de e-mail" htmlFor="il-e" required><Input id="il-e" name="email" type="email" required /></Field>
      <Field label="Rol" htmlFor="il-r" hint="Pot exista mai mulți vicepreședinți."><Select id="il-r" name="role" defaultValue="vicepresedinte"><option value="vicepresedinte">Vicepreședinte</option><option value="secretar">Secretar executiv</option></Select></Field>
    </ModalForm>
  );
}

export function LeaderRow({ p, isSelf }: { p: Profile; isSelf: boolean }) {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const editable = p.role !== "presedinte";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {editable && (
        <ModalForm wide trigger="Rol și drepturi" triggerVariant="ghost" triggerSize="sm" title={`Drepturi: ${p.full_name}`} description="Bifează funcțiile delegate acestei persoane. Fără bifă, persoana le poate doar consulta (unde este cazul)." action={S.updateLeaderAction.bind(null, p.id)}>
          <Field label="Rol" htmlFor={`r-${p.id}`}><Select id={`r-${p.id}`} name="role" defaultValue={p.role}><option value="vicepresedinte">Vicepreședinte</option><option value="secretar">Secretar executiv</option></Select></Field>
          <div className="grid gap-2 sm:grid-cols-2">{CONFIGURABLE_PERMS.map((c) => (
            <Checkbox key={c.perm} name="perms" value={c.perm} defaultChecked={hasPerm(p, c.perm)} label={<><span className="font-medium">{c.label}</span><br /><span className="text-xs text-muted">{c.hint}</span></>} />))}</div>
        </ModalForm>)}
      {editable && <ActionButton size="sm" variant="ghost" action={() => S.resendLeaderAccessAction(p.id, "email")}>Retrimite acces</ActionButton>}
      {editable && <Button size="sm" variant="ghost" onClick={async () => { const r = await S.resendLeaderAccessAction(p.id, "link"); if (r.ok) setLink(r.data?.link ?? null); else toast.error(r.error); }}>Link de activare</Button>}
      {editable && !isSelf && (p.is_active
        ? <ConfirmAction size="sm" triggerVariant="ghost" action={S.setProfileActiveAction.bind(null, p.id, false)} title="Dezactivează contul" description={`${p.full_name} nu se va mai putea autentifica. Istoricul acțiunilor rămâne păstrat.`} confirmLabel="Dezactivează">Dezactivează</ConfirmAction>
        : <ActionButton size="sm" variant="ghost" action={() => S.setProfileActiveAction(p.id, true)}>Reactivează</ActionButton>)}
      <Modal open={!!link} onClose={() => setLink(null)} title="Link de activare" description="Trimite-l personal. Este de unică folosință.">
        <Input readOnly value={link ?? ""} onFocus={(e) => e.currentTarget.select()} />
        <div className="mt-3 flex justify-end"><Button onClick={async () => { await navigator.clipboard.writeText(link ?? ""); toast.success("Link copiat."); }}>Copiază linkul</Button></div>
      </Modal>
    </div>
  );
}

export function IdentityForm({ v }: { v: { name: string; council_name: string; primary_color: string; year_label: string; logo: string | null } }) {
  const [color, setColor] = useState(v.primary_color);
  return (
    <ActionForm action={S.updateIdentityAction} successMessage="Identitatea vizuală a fost actualizată.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Numele instituției" htmlFor="i-n" required><Input id="i-n" name="name" defaultValue={v.name} required /></Field>
        <Field label="Denumirea consiliului" htmlFor="i-c" required><Input id="i-c" name="council_name" defaultValue={v.council_name} required /></Field>
        <Field label="Anul școlar curent" htmlFor="i-y"><Input id="i-y" name="year_label" defaultValue={v.year_label} /></Field>
        <Field label="Culoarea principală" htmlFor="i-col"><div className="flex items-center gap-2"><input id="i-col" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-line bg-surface" /><Input name="primary_color" value={color} onChange={(e) => setColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" className="max-w-32 font-mono" /></div></Field>
        <Field label="Logo (PNG/JPG/WebP, max. 200 KB)" htmlFor="i-l" hint="Folosește doar un logo pentru care ai permisiunea să-l utilizezi."><Input id="i-l" name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></Field>
        {v.logo && <div className="flex items-end gap-3"><img src={v.logo} alt="Logo curent" className="h-12 w-12 rounded-lg border border-line object-contain" /><Checkbox name="remove_logo" label="Elimină logo-ul" /></div>}
      </div>
      <div className="flex justify-end"><SubmitButton>Salvează</SubmitButton></div>
    </ActionForm>
  );
}

export function RemindersForm({ offsets }: { offsets: number[] }) {
  const presets = [10080, 2880, 1440, 180, 60, 15, 0];
  const label = (m: number) => m === 0 ? "La momentul începerii" : m >= 1440 ? `Cu ${m / 1440} ${m === 1440 ? "zi" : "zile"} înainte` : m >= 60 ? `Cu ${m / 60} ${m === 60 ? "oră" : "ore"} înainte` : `Cu ${m} minute înainte`;
  const extra = offsets.filter((o) => !presets.includes(o));
  return (
    <ActionForm action={S.updateRemindersAction} successMessage="Intervalele au fost salvate.">
      <div className="grid gap-2 sm:grid-cols-2">{presets.map((m) => <Checkbox key={m} name="offsets" value={String(m)} defaultChecked={offsets.includes(m)} label={label(m)} />)}</div>
      <Field label="Alte intervale (minute, separate prin virgulă)" htmlFor="r-c"><Input id="r-c" name="custom" defaultValue={extra.join(", ")} placeholder="ex. 30, 720" /></Field>
      <div className="flex justify-end"><SubmitButton>Salvează intervalele</SubmitButton></div>
    </ActionForm>
  );
}

export function NewYearButton() {
  return (
    <ModalForm trigger="Începe un an școlar nou" triggerVariant="secondary" title="An școlar nou" description="Structura anului curent se arhivează cu tot istoricul (ședințe, voturi, măsuri, documente). Se creează o Adunare Generală nouă, cu clasele copiate." action={S.newSchoolYearAction} submitLabel="Începe anul nou" submitVariant="danger">
      <Field label="Denumirea anului școlar" htmlFor="ny-l" required><Input id="ny-l" name="label" placeholder="2027–2028" required /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Început" htmlFor="ny-s"><Input id="ny-s" name="starts_on" type="date" /></Field><Field label="Sfârșit" htmlFor="ny-e"><Input id="ny-e" name="ends_on" type="date" /></Field></div>
      <Checkbox name="carry" label="Copiază reprezentanții activi în noua Adunare Generală (mandate noi)" />
    </ModalForm>
  );
}

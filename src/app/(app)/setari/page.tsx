import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { IdentityForm, InviteLeaderButton, LeaderRow, NewYearButton, RemindersForm } from "@/components/settings-controls";
import { clearDemoAction, seedDemoAction, signOutOthersAction, updateProfileAction } from "@/app/actions/settings";
import { updatePasswordAction } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Setări" };

export default async function Page() {
  const s = await requireSession();
  const supabase = await createClient();
  const [{ data: leaders }, { count: demoCount }, { data: years }] = await Promise.all([
    s.isLeadership ? supabase.from("profiles").select("*").neq("role", "reprezentant").order("role").order("full_name") : Promise.resolve({ data: [] }),
    s.isPresident ? supabase.from("meetings").select("id", { count: "exact", head: true }).eq("is_demo", true) : Promise.resolve({ count: 0 }),
    s.isPresident ? supabase.from("school_years").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const hasDemo = (demoCount ?? 0) > 0;
  return (
    <>
      <PageHeader title="Setări" description="Contul tău și, pentru președinte, configurarea spațiului digital al Consiliului." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profilul meu" subtitle={`${ROLE_LABEL[s.profile.role]} · ${s.email}`} />
          <ActionForm action={updateProfileAction} className="space-y-4 p-5">
            <Field label="Nume și prenume" htmlFor="pn" required><Input id="pn" name="full_name" defaultValue={s.profile.full_name} required /></Field>
            <Field label="Adresa de e-mail" htmlFor="pe" hint="Adresa de autentificare nu se poate schimba din aplicație."><Input id="pe" value={s.email} readOnly disabled /></Field>
            <SubmitButton>Salvează profilul</SubmitButton>
          </ActionForm>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">Rolul nu poate fi schimbat de tine. Doar președintele atribuie roluri și drepturi.</p>
        </Card>
        <Card>
          <CardHeader title="Securitate" subtitle="Parola și sesiunile" />
          <ActionForm action={updatePasswordAction} className="space-y-4 p-5" successMessage="Parola a fost schimbată.">
            <Field label="Parola nouă" htmlFor="np" required><Input id="np" name="password" type="password" minLength={8} autoComplete="new-password" required /></Field>
            <Field label="Repetă parola" htmlFor="np2" required><Input id="np2" name="password2" type="password" minLength={8} autoComplete="new-password" required /></Field>
            <SubmitButton>Schimbă parola</SubmitButton>
          </ActionForm>
          <div className="space-y-3 border-t border-line p-5 text-sm"><p className="text-muted">Dacă ai uitat contul deschis pe alt dispozitiv, închide toate celelalte sesiuni.</p>
            <div className="flex flex-wrap gap-2"><ConfirmAction action={signOutOthersAction} title="Închide celelalte sesiuni" description="Vei rămâne conectat doar pe acest dispozitiv." confirmLabel="Închide sesiunile" variant="primary">Deconectează celelalte dispozitive</ConfirmAction>
              <a href="/auth/signout" className="inline-flex items-center rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface2">Deconectează-mă</a></div></div>
        </Card>

        {s.isPresident && <>
          <Card className="lg:col-span-2"><CardHeader title="Identitatea vizuală" subtitle="Numele instituției, denumirea consiliului, anul școlar, culoarea și logo-ul" />
            <div className="p-5"><IdentityForm v={{ name: s.institution.name, council_name: s.institution.council_name, primary_color: s.institution.primary_color, year_label: s.year?.label ?? "", logo: s.institution.logo_path }} /></div></Card>
          <Card className="lg:col-span-2"><CardHeader title="Remindere automate pentru ședințe" subtitle="Notificări trimise participanților înainte de începere" />
            <div className="p-5"><RemindersForm offsets={s.institution.settings.reminder_offsets_minutes ?? [1440, 60, 0]} /></div></Card>
        </>}

        {s.isLeadership && <Card className="lg:col-span-2">
          <CardHeader title={s.isObserver ? "Conducerea" : "Conducere și observatori"} subtitle={s.isPresident ? "Conturile conducerii și drepturile delegate, plus directorul și consilierul educativ (acces doar de citire)." : "Membrii conducerii Consiliului"} action={s.isPresident && <InviteLeaderButton />} />
          <ul className="divide-y divide-line">{((leaders ?? []) as Profile[]).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div><p className="font-medium">{p.full_name} {!p.is_active && <Badge tone="bad">dezactivat</Badge>}</p><p className="text-xs text-muted">{ROLE_LABEL[p.role]} · {p.email}</p></div>
              {s.isPresident && <LeaderRow p={p} isSelf={p.id === s.userId} />}</li>))}</ul>
        </Card>}

        {s.isPresident && <>
          <Card><CardHeader title="Anul școlar" subtitle={s.year ? `Curent: ${s.year.label}` : "Niciun an activ"} />
            <div className="space-y-3 p-5 text-sm"><p className="text-muted">La începutul unui an nou, structura anterioară se arhivează fără pierderea istoricului, iar Adunarea Generală se configurează de la capăt.</p>
              <NewYearButton /><ul className="space-y-1 pt-2">{((years ?? []) as any[]).map((y) => <li key={y.id} className="flex justify-between"><span>{y.label}</span><Badge tone={y.is_current ? "ok" : "neutral"}>{y.is_current ? "curent" : "arhivat"}</Badge></li>)}</ul></div></Card>
          <Card><CardHeader title="Date demonstrative" subtitle="Pentru a încerca aplicația fără a introduce date reale" />
            <div className="space-y-3 p-5 text-sm">
              <Alert tone={hasDemo ? "warn" : "info"}>{hasDemo ? "Datele demonstrative sunt active și apar în statistici. Șterge-le înainte de utilizarea reală." : "Datele demonstrative sunt marcate DEMO (clase, reprezentanți fără cont, ședințe, vot, sesizări, proiect, anunț) și pot fi șterse oricând. Nu creează conturi."}</Alert>
              {hasDemo ? <ConfirmAction action={clearDemoAction} title="Șterge datele demonstrative" description="Se șterg doar elementele marcate DEMO. Datele reale rămân neatinse." confirmLabel="Șterge datele demo">Șterge datele demonstrative</ConfirmAction> : <ActionButton variant="secondary" action={seedDemoAction}>Încarcă date demonstrative</ActionButton>}
            </div></Card>
        </>}
      </div>
    </>
  );
}

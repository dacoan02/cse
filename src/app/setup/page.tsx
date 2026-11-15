import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { setupAction } from "@/app/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Prima configurare" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const { count } = await createAdminClient().from("institutions").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirect("/login");
  const year = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return (
    <AuthShell title="Prima configurare" subtitle="Creează spațiul digital al Consiliului și contul de președinte. Poți modifica totul ulterior din Setări.">
      <ActionForm action={setupAction}>
        {process.env.SETUP_TOKEN && <Field label="Cod de configurare" htmlFor="setup_token" required><Input id="setup_token" name="setup_token" required /></Field>}
        <Field label="Denumirea instituției de învățământ" htmlFor="institution" required><Input id="institution" name="institution" placeholder="Colegiul Național …" required /></Field>
        <Field label="Denumirea Consiliului" htmlFor="council"><Input id="council" name="council" defaultValue="Consiliul Școlar al Elevilor" /></Field>
        <Field label="Anul școlar" htmlFor="year" required><Input id="year" name="year" defaultValue={`${year}–${year + 1}`} required /></Field>
        <Field label="Clasele existente" htmlFor="classes" hint="Separate prin virgulă sau pe rânduri nou. Ex.: IX A, IX B, X A. Se pot adăuga și mai târziu."><Textarea id="classes" name="classes" rows={2} /></Field>
        <hr className="border-line" />
        <Field label="Numele și prenumele președintelui" htmlFor="full_name" required><Input id="full_name" name="full_name" required autoComplete="name" /></Field>
        <Field label="Adresa de e-mail" htmlFor="email" required><Input id="email" name="email" type="email" required autoComplete="username" /></Field>
        <Field label="Parola" htmlFor="password" required hint="Cel puțin 8 caractere."><Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" /></Field>
        <Field label="Repetă parola" htmlFor="password2" required><Input id="password2" name="password2" type="password" minLength={8} required autoComplete="new-password" /></Field>
        <Alert tone="info">Această pagină funcționează o singură dată, cât timp nu există niciun Consiliu configurat.</Alert>
        <SubmitButton className="w-full" pendingLabel="Se configurează…">Creează Consiliul</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}

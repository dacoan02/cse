import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { updatePasswordAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Parolă nouă" };

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?eroare=link");
  return (
    <AuthShell title="Alege o parolă nouă" subtitle="Folosește cel puțin 8 caractere.">
      <ActionForm action={updatePasswordAction}>
        <Field label="Parola nouă" htmlFor="password" required><Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required autoFocus /></Field>
        <Field label="Repetă parola" htmlFor="password2" required><Input id="password2" name="password2" type="password" minLength={8} autoComplete="new-password" required /></Field>
        <SubmitButton className="w-full">Salvează parola</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}

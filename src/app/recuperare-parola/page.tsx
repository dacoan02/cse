import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { requestPasswordResetAction } from "@/app/actions/auth";

export const metadata = { title: "Recuperarea parolei" };

export default function Page() {
  return (
    <AuthShell title="Recuperarea parolei" subtitle="Îți trimitem un link pentru setarea unei parole noi."
      footer={<Link href="/login" className="underline">Înapoi la autentificare</Link>}>
      <ActionForm action={requestPasswordResetAction} resetOnSuccess>
        <Field label="Adresa de e-mail" htmlFor="email" required><Input id="email" name="email" type="email" required autoFocus /></Field>
        <SubmitButton className="w-full" pendingLabel="Se trimite…">Trimite linkul</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}

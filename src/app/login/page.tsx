import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Alert, Field, Input } from "@/components/ui";
import { loginAction } from "@/app/actions/auth";

export const metadata = { title: "Autentificare" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthShell title="Autentificare" subtitle="Conectează-te cu contul primit de la conducerea Consiliului."
      footer={<>Nu ai cont? Conturile sunt create de președinte, pe bază de invitație. <br /><Link href="/setup" className="underline">Prima configurare</Link></>}>
      {sp.reason === "session" && <div className="mb-4"><Alert tone="warn">Sesiunea a expirat sau contul nu mai este activ. Autentifică-te din nou.</Alert></div>}
      {sp.eroare === "link" && <div className="mb-4"><Alert tone="error">Linkul din e-mail nu mai este valid. Cere unul nou.</Alert></div>}
      <ActionForm action={loginAction} successMessage="Te-ai autentificat.">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <Field label="Adresa de e-mail" htmlFor="email" required><Input id="email" name="email" type="email" autoComplete="username" required autoFocus /></Field>
        <Field label="Parola" htmlFor="password" required><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton className="w-full" pendingLabel="Se verifică…">Conectează-te</SubmitButton>
        <p className="text-center text-sm"><Link href="/recuperare-parola" className="text-brand hover:underline">Ai uitat parola?</Link></p>
      </ActionForm>
    </AuthShell>
  );
}

import "server-only";
import { headers } from "next/headers";
import { ActionError, type ActionContext } from "@/lib/action";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";
import { sendWelcomeEmail } from "@/lib/mail";

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

const ROLE_LABEL: Record<string, string> = { presedinte: "Președinte", secretar: "Secretar executiv", vicepresedinte: "Vicepreședinte", reprezentant: "Elev reprezentant", director: "Director", consilier: "Consilier educativ" };

export function checkPassword(password: string) {
  if (password.length < 8) throw new ActionError("Parola trebuie să aibă cel puțin 8 caractere.");
}

/** Creează contul cu parola setată de președinte (sau resetează parola unui cont existent) și trimite e-mail cu datele de acces. */
export async function provisionAccount(ctx: ActionContext, email: string, fullName: string, role: Role, password: string) {
  checkPassword(password);
  const admin = createAdminClient();
  const instId = ctx.session.institution.id;
  const { data: existing } = await admin.from("profiles").select("id,institution_id").eq("email", email).maybeSingle();
  if (existing && existing.institution_id !== instId) throw new ActionError("Această adresă de e-mail aparține unui cont din altă instituție.");
  let profileId = existing?.id as string | undefined;
  if (profileId) {
    const { error } = await admin.auth.admin.updateUserById(profileId, { password, email_confirm: true });
    if (error) throw new ActionError(`Parola nu a putut fi setată: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new ActionError(error?.message.toLowerCase().includes("already") ? "Există deja un cont cu această adresă." : `Contul nu a putut fi creat: ${error?.message}`);
    profileId = data.user.id;
    const { error: pe } = await admin.from("profiles").insert({ id: profileId, institution_id: instId, full_name: fullName, email, role });
    if (pe) { await admin.auth.admin.deleteUser(profileId); throw new ActionError(pe.message); }
  }
  const emailed = await sendWelcomeEmail({ to: email, name: fullName, password, roleLabel: ROLE_LABEL[role] ?? role, councilName: ctx.session.institution.council_name ?? "Consiliul Elevilor", siteUrl: await siteUrl() });
  return { profileId: profileId!, emailed };
}

export const accessMessage = (email: string, emailed: boolean) =>
  emailed ? `Contul este gata. Datele de acces au fost trimise la ${email}.` : `Contul este gata, dar e-mailul nu a putut fi trimis. Comunică-i personal parola aleasă (autentificare cu ${email}).`;

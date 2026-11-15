import "server-only";
import { headers } from "next/headers";
import { ActionError, type ActionContext } from "@/lib/action";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
const redirectTo = async () => `${await siteUrl()}/auth/callback?next=/resetare-parola`;

/** Creează (sau găsește) contul de autentificare și profilul; întoarce id-ul profilului și, opțional, linkul de activare. */
export async function provisionAccount(ctx: ActionContext, email: string, fullName: string, role: Role, mode: "email" | "link") {
  const admin = createAdminClient();
  const instId = ctx.session.institution.id;
  const { data: existing } = await admin.from("profiles").select("id,institution_id").eq("email", email).maybeSingle();
  if (existing && existing.institution_id !== instId) throw new ActionError("Această adresă de e-mail aparține unui cont din altă instituție.");
  let profileId = existing?.id as string | undefined;
  let link: string | null = null;
  if (!profileId) {
    if (mode === "email") {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: await redirectTo() });
      if (error || !data.user) throw new ActionError(error?.message.includes("already") ? "Există deja un cont cu această adresă." : `Invitația nu a putut fi trimisă: ${error?.message}`);
      profileId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: await redirectTo() } });
      if (error || !data.user) throw new ActionError(`Linkul nu a putut fi generat: ${error?.message}`);
      profileId = data.user.id; link = data.properties.action_link;
    }
    const { error: pe } = await admin.from("profiles").insert({ id: profileId, institution_id: instId, full_name: fullName, email, role });
    if (pe) { await admin.auth.admin.deleteUser(profileId); throw new ActionError(pe.message); }
  } else if (mode === "link") {
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: await redirectTo() } });
    if (error) throw new ActionError(error.message);
    link = data.properties.action_link;
  } else {
    await admin.auth.resetPasswordForEmail(email, { redirectTo: await redirectTo() });
  }
  return { profileId, link };
}


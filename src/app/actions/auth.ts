"use server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionError, optStr, requireStr, runAction, str, friendlyError, type ActionResult } from "@/lib/action";

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export async function loginAction(fd: FormData): Promise<ActionResult> {
  try {
    const email = requireStr(fd, "email", "E-mail").toLowerCase();
    const password = str(fd, "password");
    if (!password) throw new ActionError("Introdu parola.");
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false, error: "E-mailul sau parola sunt incorecte." };
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
    if (!profile) { await supabase.auth.signOut(); return { ok: false, error: "Contul nu este asociat niciunui Consiliu. Contactează președintele." }; }
    if (!profile.is_active) { await supabase.auth.signOut(); return { ok: false, error: "Contul tău a fost dezactivat. Contactează președintele Consiliului." }; }
    const next = str(fd, "next");
    return { ok: true, message: "Te-ai autentificat.", redirectTo: next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard" };
  } catch (e) { return { ok: false, error: friendlyError(e) }; }
}

export async function requestPasswordResetAction(fd: FormData): Promise<ActionResult> {
  try {
    const email = requireStr(fd, "email", "E-mail").toLowerCase();
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await siteUrl()}/auth/callback?next=/resetare-parola` });
    // Răspuns identic indiferent dacă adresa există, ca să nu dezvăluim conturile existente.
    return { ok: true, message: "Dacă adresa există în sistem, ai primit un e-mail cu instrucțiuni." };
  } catch (e) { return { ok: false, error: friendlyError(e) }; }
}

export async function updatePasswordAction(fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const p1 = str(fd, "password"), p2 = str(fd, "password2");
    if (p1.length < 8) throw new ActionError("Parola trebuie să aibă cel puțin 8 caractere.");
    if (p1 !== p2) throw new ActionError("Cele două parole nu coincid.");
    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) throw new ActionError(error.message.includes("same") ? "Noua parolă trebuie să fie diferită de cea veche." : "Parola nu a putut fi schimbată.");
    return { ok: true, message: "Parola a fost schimbată.", redirectTo: "/dashboard" };
  });
}

/** Configurarea inițială: creează instituția, anul școlar, președintele și clasele. Permisă doar cât timp nu există nicio instituție. */
export async function setupAction(fd: FormData): Promise<ActionResult> {
  try {
    const admin = createAdminClient();
    const { count } = await admin.from("institutions").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new ActionError("Aplicația este deja configurată. Autentifică-te.");
    if (process.env.SETUP_TOKEN && str(fd, "setup_token") !== process.env.SETUP_TOKEN) throw new ActionError("Codul de configurare este incorect.");

    const name = requireStr(fd, "institution", "Denumirea instituției");
    const council = optStr(fd, "council") ?? "Consiliul Școlar al Elevilor";
    const year = requireStr(fd, "year", "Anul școlar");
    const fullName = requireStr(fd, "full_name", "Numele președintelui");
    const email = requireStr(fd, "email", "E-mail").toLowerCase();
    const password = str(fd, "password");
    if (password.length < 8) throw new ActionError("Parola trebuie să aibă cel puțin 8 caractere.");
    if (password !== str(fd, "password2")) throw new ActionError("Cele două parole nu coincid.");
    const classNames = [...new Set(str(fd, "classes").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))];

    const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (ue || !u.user) throw new ActionError(ue?.message ?? "Contul nu a putut fi creat.");
    try {
      const { data: inst, error: ie } = await admin.from("institutions").insert({ name, council_name: council }).select("id").single();
      if (ie) throw ie;
      const { data: sy, error: se } = await admin.from("school_years").insert({ institution_id: inst.id, label: year, is_current: true }).select("id").single();
      if (se) throw se;
      const { error: pe } = await admin.from("profiles").insert({ id: u.user.id, institution_id: inst.id, full_name: fullName, email, role: "presedinte" });
      if (pe) throw pe;
      if (classNames.length) {
        const { error: ce } = await admin.from("classes").insert(classNames.map((n) => ({ institution_id: inst.id, school_year_id: sy.id, name: n })));
        if (ce) throw ce;
      }
    } catch (e) {
      await admin.from("institutions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.auth.admin.deleteUser(u.user.id);
      throw e;
    }
    return { ok: true, message: "Consiliul a fost configurat. Autentifică-te cu contul de președinte.", redirectTo: "/login" };
  } catch (e) { return { ok: false, error: friendlyError(e) }; }
}

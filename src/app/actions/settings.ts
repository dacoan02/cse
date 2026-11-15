"use server";
import { ActionError, changed, optStr, requireStr, runAction, str, unwrap, type ActionResult } from "@/lib/action";
import { provisionAccount } from "@/lib/accounts";
import { CONFIGURABLE_PERMS } from "@/lib/permissions";

function needPresident(s: { isPresident: boolean }) { if (!s.isPresident) throw new ActionError("Doar președintele poate efectua această acțiune."); }

export async function updateProfileAction(fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    changed(await supabase.from("profiles").update({ full_name: requireStr(fd, "full_name", "Numele") }).eq("id", session.userId).select("id"));
    return { ok: true, message: "Profilul a fost actualizat." };
  });
}
export async function signOutOthersAction(): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) throw new Error(error.message);
    return { ok: true, message: "Celelalte sesiuni au fost închise. Rămâi conectat doar pe acest dispozitiv." };
  });
}

export async function updateIdentityAction(fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    needPresident(session);
    const color = str(fd, "primary_color") || "#1d4ed8";
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new ActionError("Culoarea trebuie să fie în format #RRGGBB.");
    const patch: Record<string, unknown> = { name: requireStr(fd, "name", "Numele instituției"), council_name: requireStr(fd, "council_name", "Denumirea consiliului"), primary_color: color };
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(logo.type)) throw new ActionError("Logo-ul trebuie să fie PNG, JPG sau WebP.");
      if (logo.size > 200 * 1024) throw new ActionError("Logo-ul depășește 200 KB.");
      patch.logo_path = `data:${logo.type};base64,${Buffer.from(await logo.arrayBuffer()).toString("base64")}`;
    }
    if (str(fd, "remove_logo") === "on") patch.logo_path = null;
    changed(await supabase.from("institutions").update(patch).eq("id", session.institution.id).select("id"));
    const label = optStr(fd, "year_label");
    if (label && session.year && label !== session.year.label) changed(await supabase.from("school_years").update({ label }).eq("id", session.year.id).select("id"));
    return { ok: true, message: "Identitatea vizuală a fost actualizată." };
  });
}

export async function updateRemindersAction(fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    needPresident(session);
    const preset = fd.getAll("offsets").map((x) => Number(x));
    const custom = str(fd, "custom").split(/[\s,;]+/).filter(Boolean).map(Number);
    const all = [...new Set([...preset, ...custom])];
    if (all.some((n) => !Number.isInteger(n) || n < 0 || n > 60 * 24 * 30)) throw new ActionError("Intervalele trebuie să fie numere întregi de minute, între 0 și 43200.");
    changed(await supabase.from("institutions").update({ settings: { ...session.institution.settings, reminder_offsets_minutes: all.sort((a, b) => b - a) } }).eq("id", session.institution.id).select("id"));
    return { ok: true, message: "Intervalele de remindere au fost salvate (se aplică ședințelor publicate de acum încolo)." };
  });
}

export async function inviteLeaderAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    needPresident(ctx.session);
    const role = str(fd, "role");
    if (!["secretar", "vicepresedinte"].includes(role)) throw new ActionError("Rol invalid.");
    const email = requireStr(fd, "email", "E-mail").toLowerCase();
    const name = requireStr(fd, "full_name", "Numele");
    if (role === "secretar") {
      const { count } = await ctx.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "secretar").eq("is_active", true);
      if ((count ?? 0) > 0) throw new ActionError("Există deja un secretar executiv activ. Dezactivează contul existent sau schimbă-i rolul mai întâi.");
    }
    await provisionAccount(ctx, email, name, role as "secretar" | "vicepresedinte", "email");
    return { ok: true, message: `Invitația a fost trimisă la ${email}.` };
  });
}
export async function updateLeaderAction(profileId: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    needPresident(session);
    const role = str(fd, "role");
    const perms: Record<string, boolean> = {};
    const checked = new Set(fd.getAll("perms").map(String));
    for (const p of CONFIGURABLE_PERMS) perms[p.perm] = checked.has(p.perm);
    changed(await supabase.from("profiles").update({ role, permissions: perms }).eq("id", profileId).select("id"));
    return { ok: true, message: "Rolul și drepturile au fost actualizate." };
  });
}
export async function setProfileActiveAction(profileId: string, active: boolean): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    needPresident(session);
    changed(await supabase.from("profiles").update({ is_active: active }).eq("id", profileId).select("id"));
    return { ok: true, message: active ? "Contul a fost reactivat." : "Contul a fost dezactivat. Istoricul a fost păstrat." };
  });
}
export async function resendLeaderAccessAction(profileId: string, mode: "email" | "link"): Promise<ActionResult<{ link: string | null }>> {
  return runAction<{ link: string | null }>(async (ctx) => {
    needPresident(ctx.session);
    const p = unwrap(await ctx.supabase.from("profiles").select("email,full_name,role").eq("id", profileId).single()) as { email: string; full_name: string; role: "secretar" | "vicepresedinte" };
    const { link } = await provisionAccount(ctx, p.email, p.full_name, p.role, mode);
    return { ok: true, message: mode === "email" ? "Linkul de acces a fost trimis." : "Link generat.", data: { link } };
  });
}

export async function newSchoolYearAction(fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    needPresident(session);
    const { error } = await supabase.rpc("start_new_school_year", { p_label: requireStr(fd, "label", "Anul școlar"), p_starts: optStr(fd, "starts_on"), p_ends: optStr(fd, "ends_on"), p_carry_reps: str(fd, "carry") === "on" });
    if (error) throw new Error(error.message);
    return { ok: true, message: "Anul școlar nou a fost început. Structura anterioară este arhivată, cu tot istoricul." };
  });
}
export async function seedDemoAction(): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { const { error } = await supabase.rpc("seed_demo_data"); if (error) throw new Error(error.message); return { ok: true, message: "Datele demonstrative au fost încărcate. Sunt marcate DEMO și pot fi șterse." }; });
}
export async function clearDemoAction(): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { const { error } = await supabase.rpc("clear_demo_data"); if (error) throw new Error(error.message); return { ok: true, message: "Datele demonstrative au fost șterse." }; });
}

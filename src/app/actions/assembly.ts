"use server";
import Papa from "papaparse";
import { ActionError, changed, optStr, requireStr, runAction, str, unwrap, type ActionContext, type ActionResult } from "@/lib/action";
import { provisionAccount } from "@/lib/accounts";

function needManage(ctx: ActionContext) {
  if (!ctx.session.can("manage_representatives")) throw new ActionError("Nu ai dreptul să administrezi Adunarea Generală.");
}
export async function addRepresentativeAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    needManage(ctx);
    const full_name = requireStr(fd, "full_name", "Numele și prenumele");
    const class_id = requireStr(fd, "class_id", "Clasa reprezentată");
    const email = optStr(fd, "email")?.toLowerCase() ?? null;
    const invite = str(fd, "invite") === "on";
    if (invite && !email) throw new ActionError("Pentru a trimite invitația, completează adresa de e-mail.");
    const row = unwrap(await ctx.supabase.from("representatives").insert({
      full_name, class_id, position: optStr(fd, "position") ?? "Reprezentant", email, notes: optStr(fd, "notes"),
      mandate_start: optStr(fd, "mandate_start") ?? new Date().toISOString().slice(0, 10),
    }).select("id").single()) as { id: string };
    if (invite && email) {
      const { profileId } = await provisionAccount(ctx, email, full_name, "reprezentant", "email");
      unwrap(await ctx.supabase.from("representatives").update({ profile_id: profileId, invited_at: new Date().toISOString() }).eq("id", row.id).select("id"));
      return { ok: true, message: `Reprezentantul a fost adăugat, iar invitația a fost trimisă la ${email}.` };
    }
    return { ok: true, message: "Reprezentantul a fost adăugat în Adunarea Generală." };
  });
}

export async function updateRepresentativeAction(id: string, fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    needManage(ctx);
    changed(await ctx.supabase.from("representatives").update({
      full_name: requireStr(fd, "full_name", "Numele și prenumele"), class_id: requireStr(fd, "class_id", "Clasa reprezentată"),
      position: optStr(fd, "position") ?? "Reprezentant", email: optStr(fd, "email")?.toLowerCase() ?? null,
      mandate_start: optStr(fd, "mandate_start") ?? undefined, notes: optStr(fd, "notes"),
    }).eq("id", id).select("id"));
    return { ok: true, message: "Datele reprezentantului au fost actualizate." };
  });
}

export async function setRepresentativeStatusAction(id: string, status: "active" | "inactive" | "removed"): Promise<ActionResult> {
  return runAction(async (ctx) => {
    needManage(ctx);
    const rep = unwrap(await ctx.supabase.from("representatives").select("profile_id").eq("id", id).single()) as { profile_id: string | null };
    changed(await ctx.supabase.from("representatives").update({ status, mandate_end: status === "active" ? null : new Date().toISOString().slice(0, 10) }).eq("id", id).select("id"));
    if (rep.profile_id && ctx.session.isPresident) {
      // contul de autentificare urmează statutul mandatului; istoricul rămâne păstrat
      await ctx.supabase.from("profiles").update({ is_active: status === "active" }).eq("id", rep.profile_id);
    }
    return { ok: true, message: { active: "Reprezentantul a fost reactivat.", inactive: "Contul a fost dezactivat. Istoricul a fost păstrat.", removed: "Reprezentantul a fost eliminat din structura activă. Istoricul a fost păstrat." }[status] };
  });
}

export async function inviteRepresentativeAction(id: string, mode: "email" | "link"): Promise<ActionResult<{ link: string | null }>> {
  return runAction<{ link: string | null }>(async (ctx) => {
    needManage(ctx);
    const rep = unwrap(await ctx.supabase.from("representatives").select("full_name,email,profile_id").eq("id", id).single()) as { full_name: string; email: string | null; profile_id: string | null };
    if (!rep.email) throw new ActionError("Reprezentantul nu are adresă de e-mail. Editează-l și adaug-o mai întâi.");
    const { profileId, link } = await provisionAccount(ctx, rep.email.toLowerCase(), rep.full_name, "reprezentant", mode);
    changed(await ctx.supabase.from("representatives").update({ profile_id: profileId, invited_at: new Date().toISOString() }).eq("id", id).select("id"));
    return { ok: true, message: mode === "email" ? `Invitația a fost trimisă la ${rep.email}.` : "Link generat. Trimite-l reprezentantului.", data: { link } };
  });
}

export async function addClassAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    needManage(ctx);
    const names = [...new Set(requireStr(fd, "names", "Denumirea clasei").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))];
    unwrap(await ctx.supabase.from("classes").upsert(names.map((name) => ({ name, school_year_id: ctx.session.year!.id })), { onConflict: "school_year_id,name", ignoreDuplicates: true }).select("id"));
    return { ok: true, message: names.length > 1 ? `${names.length} clase adăugate.` : "Clasa a fost adăugată." };
  });
}
export async function renameClassAction(id: string, fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => { needManage(ctx); changed(await ctx.supabase.from("classes").update({ name: requireStr(fd, "name", "Denumirea") }).eq("id", id).select("id")); return { ok: true, message: "Clasa a fost redenumită." }; });
}
export async function deleteClassAction(id: string): Promise<ActionResult> {
  return runAction(async (ctx) => {
    needManage(ctx);
    const { count } = await ctx.supabase.from("representatives").select("id", { count: "exact", head: true }).eq("class_id", id);
    if (count) throw new ActionError("Clasa are reprezentanți asociați. Transferă-i mai întâi în altă clasă.");
    changed(await ctx.supabase.from("classes").delete().eq("id", id).select("id"));
    return { ok: true, message: "Clasa a fost ștearsă." };
  });
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const KEYS: Record<string, string[]> = {
  name: ["nume", "numeprenume", "numesiprenume", "elev", "reprezentant", "numele"], cls: ["clasa", "clasareprezentata", "clasă"].map(norm),
  position: ["functia", "functie", "functiaintradunare"], email: ["email", "adresaemail", "mail", "adresadeemail"], start: ["inceputmandat", "datainceperiimandatului", "mandat", "datainceput"],
};

export async function importRepresentativesAction(fd: FormData): Promise<ActionResult<{ added: number; skipped: string[] }>> {
  return runAction<{ added: number; skipped: string[] }>(async (ctx) => {
    needManage(ctx);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("Alege un fișier .csv sau .xlsx.");
    if (file.size > 5 * 1024 * 1024) throw new ActionError("Fișierul depășește 5 MB.");
    const ext = file.name.split(".").pop()?.toLowerCase();
    let rows: string[][] = [];
    if (ext === "csv" || ext === "txt") {
      const parsed = Papa.parse<string[]>((await file.text()).replace(/^﻿/, ""), { skipEmptyLines: true });
      rows = parsed.data.map((r) => r.map((c) => String(c ?? "").trim()));
    } else if (ext === "xlsx") {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer() as ArrayBuffer);
      const ws = wb.worksheets[0];
      ws?.eachRow((row) => { rows.push((row.values as unknown[]).slice(1).map((c) => (c && typeof c === "object" && "text" in (c as object) ? String((c as { text: string }).text) : String(c ?? "")).trim())); });
    } else throw new ActionError("Format neacceptat. Folosește .csv sau .xlsx.");
    if (rows.length < 2) throw new ActionError("Fișierul nu conține date (este nevoie de un rând de antet și cel puțin un reprezentant).");
    const header = rows[0].map(norm);
    const idx = (k: string) => header.findIndex((h) => KEYS[k].map(norm).includes(h));
    const iName = idx("name"), iCls = idx("cls");
    if (iName < 0 || iCls < 0) throw new ActionError("Antetul trebuie să conțină cel puțin coloanele „Nume” și „Clasa”. Opționale: Funcția, E-mail, Început mandat.");
    const iPos = idx("position"), iMail = idx("email"), iStart = idx("start");

    const { data: existingCls } = await ctx.supabase.from("classes").select("id,name").eq("school_year_id", ctx.session.year!.id);
    const classMap = new Map((existingCls ?? []).map((c: any) => [c.name.toLowerCase().replace(/\s+/g, ""), c.id as string]));
    const { data: existingReps } = await ctx.supabase.from("representatives").select("full_name,class_id").eq("school_year_id", ctx.session.year!.id).neq("status", "removed");
    const seen = new Set((existingReps ?? []).map((r: any) => `${r.full_name.toLowerCase()}|${r.class_id}`));
    const skipped: string[] = []; const toInsert: Record<string, unknown>[] = [];
    for (const [n, r] of rows.slice(1).entries()) {
      const name = r[iName]?.trim(); const clsName = r[iCls]?.trim();
      if (!name || !clsName) { skipped.push(`Rândul ${n + 2}: nume sau clasă lipsă`); continue; }
      const key = clsName.toLowerCase().replace(/\s+/g, "");
      let clsId = classMap.get(key);
      if (!clsId) {
        const c = unwrap(await ctx.supabase.from("classes").insert({ name: clsName, school_year_id: ctx.session.year!.id }).select("id").single()) as { id: string };
        clsId = c.id; classMap.set(key, clsId);
      }
      if (seen.has(`${name.toLowerCase()}|${clsId}`)) { skipped.push(`Rândul ${n + 2}: ${name} există deja în clasa ${clsName}`); continue; }
      seen.add(`${name.toLowerCase()}|${clsId}`);
      const email = iMail >= 0 ? r[iMail]?.toLowerCase() : "";
      if (email && !/^\S+@\S+\.\S+$/.test(email)) { skipped.push(`Rândul ${n + 2}: e-mail invalid (${email})`); continue; }
      const start = iStart >= 0 ? r[iStart] : "";
      toInsert.push({ full_name: name, class_id: clsId, position: (iPos >= 0 && r[iPos]) || "Reprezentant", email: email || null,
        ...(/^\d{4}-\d{2}-\d{2}$/.test(start) ? { mandate_start: start } : {}) });
    }
    if (toInsert.length) unwrap(await ctx.supabase.from("representatives").insert(toInsert).select("id"));
    return { ok: true, message: `${toInsert.length} reprezentanți importați${skipped.length ? `, ${skipped.length} ignorați` : ""}.`, data: { added: toInsert.length, skipped } };
  });
}

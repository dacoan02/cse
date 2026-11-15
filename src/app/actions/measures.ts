"use server";
import { ActionError, changed, optStr, requireStr, runAction, str, unwrap, type ActionResult } from "@/lib/action";
import { uploadFiles, validFiles } from "@/lib/upload";

export async function addMeasureAction(repId: string, kind: "mustrare" | "avertisment" | "demitere", fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    if (!ctx.session.isPresident) throw new ActionError("Doar președintele poate înregistra măsuri administrative.");
    const row = unwrap(await ctx.supabase.from("admin_measures").insert({
      representative_id: repId, kind, reason: requireStr(fd, "reason", "Motivul"), description: optStr(fd, "description"),
      applied_on: optStr(fd, "applied_on") ?? new Date().toISOString().slice(0, 10), notes: optStr(fd, "notes"),
      procedure_status: kind === "demitere" ? str(fd, "procedure_status") || "initiata" : null, created_by: ctx.session.userId,
    }).select("id").single()) as { id: string };
    const files = validFiles(fd, "files");
    if (files.length) await uploadFiles(ctx, files, { category: "administrativ", folder: "masuri", visibility: "conducere", measure_id: row.id });
    return { ok: true, message: kind === "demitere" ? "Procedura de demitere a fost înregistrată. Aceasta nu încheie mandatul: respectă regulamentul Consiliului." : "Măsura a fost înregistrată în istoricul reprezentantului." };
  });
}
export async function updateProcedureAction(id: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    changed(await supabase.from("admin_measures").update({ procedure_status: requireStr(fd, "procedure_status", "Starea procedurii"), notes: optStr(fd, "notes") }).eq("id", id).select("id"));
    return { ok: true, message: "Starea procedurii a fost actualizată." };
  });
}

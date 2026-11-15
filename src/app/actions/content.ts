"use server";
import { ActionError, changed, optStr, requireStr, runAction, str, unwrap, type ActionResult } from "@/lib/action";
import { localInputToIso } from "@/lib/format";
import { uploadFiles, validFiles } from "@/lib/upload";

export async function publishAnnouncementAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    const audience = str(fd, "audience") || "toti";
    const recipients = fd.getAll("recipients").map(String);
    if (audience === "selectie" && recipients.length === 0) throw new ActionError("Selectează cel puțin un destinatar.");
    const { data, error } = await ctx.supabase.rpc("publish_announcement", {
      p_title: requireStr(fd, "title", "Titlul"), p_content: requireStr(fd, "content", "Conținutul"), p_audience: audience, p_pinned: str(fd, "pinned") === "on", p_recipients: recipients,
    });
    if (error) throw new Error(error.message);
    const files = validFiles(fd, "files");
    if (files.length) await uploadFiles(ctx, files, { category: "altele", folder: "anunturi", announcement_id: data as string });
    return { ok: true, message: "Anunțul a fost publicat, iar destinatarii au fost notificați." };
  });
}
export async function togglePinAction(id: string, pinned: boolean): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("announcements").update({ pinned }).eq("id", id).select("id")); return { ok: true, message: pinned ? "Anunțul a fost fixat în partea de sus." : "Anunțul nu mai este fixat." }; });
}
export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("announcements").delete().eq("id", id).select("id")); return { ok: true, message: "Anunțul a fost șters." }; });
}

export async function uploadDocumentAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    const files = validFiles(fd, "files");
    if (!files.length) throw new ActionError("Alege cel puțin un fișier.");
    await uploadFiles(ctx, files, {
      category: str(fd, "category") || "altele", folder: "arhiva", title: optStr(fd, "title") ?? undefined, description: optStr(fd, "description") ?? undefined,
      visibility: (str(fd, "visibility") || "toti") as "toti" | "conducere", meeting_id: optStr(fd, "meeting_id"), project_id: optStr(fd, "project_id"), activity_id: optStr(fd, "activity_id"),
    });
    return { ok: true, message: files.length > 1 ? `${files.length} documente încărcate.` : "Documentul a fost încărcat în arhivă." };
  });
}
export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const doc = unwrap(await supabase.from("documents").select("storage_path").eq("id", id).single()) as { storage_path: string };
    changed(await supabase.from("documents").delete().eq("id", id).select("id"));
    await supabase.storage.from("documents").remove([doc.storage_path]);
    return { ok: true, message: "Documentul a fost șters." };
  });
}

export async function addCalendarEventAction(fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    const end = optStr(fd, "ends_at");
    unwrap(await supabase.from("calendar_events").insert({
      title: requireStr(fd, "title", "Titlul"), description: optStr(fd, "description"), kind: str(fd, "kind") || "eveniment",
      starts_at: localInputToIso(requireStr(fd, "starts_at", "Data și ora")), ends_at: end ? localInputToIso(end) : null, created_by: session.userId,
    }).select("id"));
    return { ok: true, message: "Evenimentul a fost adăugat în calendar." };
  });
}
export async function deleteCalendarEventAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("calendar_events").delete().eq("id", id).select("id")); return { ok: true, message: "Evenimentul a fost șters." }; });
}

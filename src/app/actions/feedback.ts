"use server";
import { ActionError, changed, optStr, requireStr, runAction, str, unwrap, type ActionResult } from "@/lib/action";
import { uploadFiles, validFiles } from "@/lib/upload";

export async function submitFeedbackAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    const { supabase, session } = ctx;
    const { data: rep } = await supabase.from("representatives").select("id,class_id").eq("profile_id", session.userId).eq("school_year_id", session.year?.id ?? "").maybeSingle();
    const row = unwrap(await supabase.from("feedback_items").insert({
      author_id: session.userId, representative_id: rep?.id ?? null, kind: str(fd, "kind") || "problema",
      title: requireStr(fd, "title", "Titlul mesajului"), description: requireStr(fd, "description", "Descrierea situației"),
      class_id: optStr(fd, "class_id") ?? rep?.class_id ?? null, proposed_solution: optStr(fd, "proposed_solution"), importance: str(fd, "importance") || "mediu",
    }).select("id").single()) as { id: string };
    const files = validFiles(fd, "files");
    if (files.length) await uploadFiles(ctx, files, { category: "atasament", folder: "feedback", visibility: "restrans", feedback_id: row.id });
    return { ok: true, message: "Mesajul a fost trimis conducerii. Vei fi notificat când este analizat.", redirectTo: `/vocea-reprezentantilor/${row.id}` };
  });
}

export async function manageFeedbackAction(id: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const status = requireStr(fd, "status", "Starea");
    const response = optStr(fd, "official_response");
    if ((status === "solutionat" || status === "respins") && !response) throw new ActionError("Introdu un răspuns oficial înainte de a marca sesizarea ca soluționată sau respinsă.");
    changed(await supabase.from("feedback_items").update({ status, assigned_to: optStr(fd, "assigned_to"), official_response: response }).eq("id", id).select("id"));
    return { ok: true, message: "Sesizarea a fost actualizată, iar autorul a fost notificat." };
  });
}

export async function addFeedbackNoteAction(id: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    unwrap(await supabase.from("feedback_notes").insert({ feedback_id: id, author_id: session.userId, body: requireStr(fd, "body", "Observația") }).select("id"));
    return { ok: true, message: "Observația internă a fost adăugată." };
  });
}

"use server";
import { revalidatePath } from "next/cache";
import { ActionError, changed, optStr, requireStr, runAction, str, unwrap, type ActionResult } from "@/lib/action";
import { localInputToIso } from "@/lib/format";
import { uploadFiles, validFiles } from "@/lib/upload";

const rpc = async (supabase: import("@supabase/supabase-js").SupabaseClient, fn: string, args: Record<string, unknown>) => {
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
};

export async function saveMeetingAction(fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    const { supabase, session } = ctx;
    const id = optStr(fd, "id");
    const intent = str(fd, "intent"); // "draft" | "publish"
    const title = requireStr(fd, "title", "Titlul ședinței");
    const startsRaw = requireStr(fd, "starts_at", "Data și ora începerii");
    const endRaw = optStr(fd, "expected_end_at");
    const starts_at = localInputToIso(startsRaw);
    const expected_end_at = endRaw ? localInputToIso(endRaw) : null;
    if (expected_end_at && expected_end_at < starts_at) throw new ActionError("Ora estimată de încheiere trebuie să fie după ora începerii.");
    const mode = str(fd, "mode") || "fizic";
    const online_link = optStr(fd, "online_link");
    if (mode !== "fizic" && !online_link && intent === "publish") throw new ActionError("Pentru o ședință online sau hibridă adaugă linkul de participare.");
    const row = {
      title, meeting_type: str(fd, "meeting_type") || "ordinara", starts_at, expected_end_at,
      location: optStr(fd, "location"), mode, online_link, reason: optStr(fd, "reason"), description: optStr(fd, "description"),
    };
    let meetingId = id;
    if (id) changed(await supabase.from("meetings").update(row).eq("id", id).select("id"));
    else meetingId = (unwrap(await supabase.from("meetings").insert({ ...row, created_by: session.userId }).select("id").single()) as { id: string }).id;
    if (!meetingId) throw new ActionError("Ședința nu a putut fi salvată.");

    // Ordinea de zi: un punct pe rând
    const agenda = str(fd, "agenda").split("\n").map((l) => l.trim()).filter(Boolean);
    unwrap(await supabase.from("agenda_items").delete().eq("meeting_id", meetingId).select("id"));
    if (agenda.length) unwrap(await supabase.from("agenda_items").insert(agenda.map((t, i) => ({ meeting_id: meetingId, position: i + 1, title: t }))).select("id"));

    // Destinatari
    const repIds = fd.getAll("rep_ids").map(String);
    const profileIds = fd.getAll("profile_ids").map(String);
    await rpc(supabase, "set_meeting_recipients", { p_meeting: meetingId, p_all_reps: false, p_rep_ids: repIds, p_profile_ids: profileIds });

    // Documente
    const conv = validFiles(fd, "convocator");
    const att = validFiles(fd, "attachments");
    if (conv.length) await uploadFiles(ctx, conv, { category: "convocator", folder: "sedinte", meeting_id: meetingId, title: `Convocator – ${title}` });
    if (att.length) await uploadFiles(ctx, att, { category: "altele", folder: "sedinte", meeting_id: meetingId });

    if (intent === "publish") {
      const { data: m } = await supabase.from("meetings").select("status").eq("id", meetingId).single();
      if (m?.status === "draft") await rpc(supabase, "publish_meeting", { p_meeting: meetingId });
    }
    revalidatePath("/sedinte");
    return { ok: true, message: intent === "publish" ? "Ședința a fost publicată, iar participanții au fost notificați." : "Ședința a fost salvată.", redirectTo: `/sedinte/${meetingId}` };
  });
}

export async function publishMeetingAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { await rpc(supabase, "publish_meeting", { p_meeting: id }); return { ok: true, message: "Ședința a fost publicată, iar participanții au fost notificați." }; });
}
export async function startMeetingAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { await rpc(supabase, "start_meeting", { p_meeting: id }); return { ok: true, message: "Ședința a început." }; });
}
export async function cancelMeetingAction(id: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { await rpc(supabase, "cancel_meeting", { p_meeting: id, p_reason: optStr(fd, "reason") }); return { ok: true, message: "Ședința a fost anulată, iar participanții au fost informați." }; });
}
export async function finishMeetingAction(id: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    await rpc(supabase, "finish_meeting", { p_meeting: id, p_ended_at: null, p_decisions: optStr(fd, "decisions") });
    return { ok: true, message: "Ședința a fost marcată ca desfășurată. Prezența și cvorumul final au fost salvate în arhivă." };
  });
}
export async function archiveMeetingAction(id: string, archived: boolean): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("meetings").update({ archived }).eq("id", id).select("id")); return { ok: true, message: archived ? "Ședința a fost arhivată." : "Ședința a fost restaurată." }; });
}
export async function deleteDraftMeetingAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("meetings").delete().eq("id", id).eq("status", "draft").select("id")); return { ok: true, message: "Ciorna a fost ștearsă.", redirectTo: "/sedinte" }; });
}
export async function setAttendanceAction(meetingId: string, status: "present" | "absent"): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    await rpc(supabase, "set_attendance", { p_meeting: meetingId, p_status: status });
    return { ok: true, message: status === "present" ? "Prezența ta a fost confirmată." : "Absența ta a fost înregistrată." };
  });
}
export async function setAttendanceForAction(participantId: string, status: "present" | "absent" | "no_response"): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { await rpc(supabase, "set_attendance_for", { p_participant: participantId, p_status: status }); return { ok: true, message: "Evidența prezenței a fost actualizată." }; });
}
export async function saveAgendaAction(meetingId: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const agenda = str(fd, "agenda").split("\n").map((l) => l.trim()).filter(Boolean);
    unwrap(await supabase.from("agenda_items").delete().eq("meeting_id", meetingId).select("id"));
    if (agenda.length) unwrap(await supabase.from("agenda_items").insert(agenda.map((t, i) => ({ meeting_id: meetingId, position: i + 1, title: t }))).select("id"));
    if (str(fd, "notify") === "on") await rpc(supabase, "announce_agenda", { p_meeting: meetingId });
    return { ok: true, message: str(fd, "notify") === "on" ? "Ordinea de zi a fost salvată și publicată participanților." : "Ordinea de zi a fost salvată." };
  });
}
export async function uploadMeetingDocAction(meetingId: string, fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    const files = validFiles(fd, "files");
    if (!files.length) throw new ActionError("Alege cel puțin un fișier.");
    const category = str(fd, "category") || "altele";
    await uploadFiles(ctx, files, { category, folder: "sedinte", meeting_id: meetingId, title: optStr(fd, "title") ?? undefined, visibility: category === "proces_verbal" ? "toti" : "toti" });
    return { ok: true, message: "Documentul a fost încărcat." };
  });
}
export async function saveDecisionsAction(meetingId: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    changed(await supabase.from("meetings").update({ decisions: optStr(fd, "decisions") }).eq("id", meetingId).select("id"));
    return { ok: true, message: "Deciziile au fost salvate." };
  });
}

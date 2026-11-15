"use server";
import { runAction, unwrap, type ActionResult } from "@/lib/action";

export async function setNotificationRead(id: string, read: boolean): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    unwrap(await supabase.from("notifications").update({ is_read: read }).eq("id", id).eq("user_id", session.userId).select("id"));
    return { ok: true, message: read ? "Marcată ca citită." : "Marcată ca necitită." };
  });
}
export async function archiveNotification(id: string, archived = true): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    unwrap(await supabase.from("notifications").update({ is_archived: archived, is_read: true }).eq("id", id).eq("user_id", session.userId).select("id"));
    return { ok: true, message: archived ? "Notificare arhivată." : "Notificare restaurată." };
  });
}
export async function markAllRead(): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    unwrap(await supabase.from("notifications").update({ is_read: true }).eq("user_id", session.userId).eq("is_read", false).select("id"));
    return { ok: true, message: "Toate notificările au fost marcate ca citite." };
  });
}
export async function openNotification(id: string): Promise<void> {
  await runAction(async ({ supabase, session }) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", session.userId);
  });
}

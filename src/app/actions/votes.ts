"use server";
import { ActionError, changed, optStr, requireStr, runAction, str, type ActionResult } from "@/lib/action";
import { localInputToIso } from "@/lib/format";

export async function createVoteAction(fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const type = requireStr(fd, "vote_type", "Tipul votului");
    const startsRaw = str(fd, "starts_at");
    const endsRaw = requireStr(fd, "ends_at", "Data și ora încheierii");
    const options = str(fd, "options").split("\n").map((l) => l.trim()).filter(Boolean);
    if (["alegere_multipla", "desemnare_persoana"].includes(type) && options.length < 2) throw new ActionError("Adaugă cel puțin două opțiuni, câte una pe rând.");
    const scope = str(fd, "eligible_scope") || "reprezentanti";
    const payload = {
      title: requireStr(fd, "title", "Titlul votului"), question: requireStr(fd, "question", "Întrebarea"), description: optStr(fd, "description"),
      vote_type: type, options, is_secret: str(fd, "is_secret") === "on", show_interim: str(fd, "show_interim") === "on",
      starts_at: startsRaw ? localInputToIso(startsRaw) : new Date().toISOString(), ends_at: localInputToIso(endsRaw),
      eligible_scope: scope, eligible_ids: fd.getAll("eligible_ids").map(String), meeting_id: optStr(fd, "meeting_id"),
    };
    const { data, error } = await supabase.rpc("create_vote", { p_data: payload });
    if (error) throw new Error(error.message);
    return { ok: true, message: "Votul a fost creat, iar participanții eligibili au fost notificați.", redirectTo: `/voturi/${data}` };
  });
}

export async function castVoteAction(voteId: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const option = requireStr(fd, "option", "Opțiunea");
    const { error } = await supabase.rpc("cast_vote", { p_vote: voteId, p_option: option });
    if (error) throw new Error(error.message);
    return { ok: true, message: "Votul tău a fost înregistrat." };
  });
}

export async function closeVoteAction(voteId: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    const { error } = await supabase.rpc("close_vote", { p_vote: voteId });
    if (error) throw new Error(error.message);
    return { ok: true, message: "Votul a fost încheiat, iar rezultatul a fost centralizat și publicat." };
  });
}

export async function saveVoteDecisionAction(voteId: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase }) => {
    changed(await supabase.from("votes").update({ decision_text: optStr(fd, "decision_text") }).eq("id", voteId).select("id"));
    return { ok: true, message: "Decizia a fost salvată." };
  });
}

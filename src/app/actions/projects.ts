"use server";
import { ActionError, changed, optStr, requireStr, runAction, str, unwrap, type ActionResult } from "@/lib/action";
import { localInputToIso } from "@/lib/format";
import { uploadFiles, validFiles } from "@/lib/upload";

export async function saveProjectAction(id: string | null, fd: FormData): Promise<ActionResult> {
  return runAction(async (ctx) => {
    const { supabase, session } = ctx;
    const starts_on = optStr(fd, "starts_on"), ends_on = optStr(fd, "ends_on");
    if (starts_on && ends_on && ends_on < starts_on) throw new ActionError("Data finalizării trebuie să fie după data începerii.");
    const row = {
      title: requireStr(fd, "title", "Titlul proiectului"), description: optStr(fd, "description"), objectives: optStr(fd, "objectives"),
      category: str(fd, "category") || "educational", starts_on, ends_on, location: optStr(fd, "location"), status: str(fd, "status") || "in_pregatire", notes: optStr(fd, "notes"),
    };
    let pid = id;
    if (id) changed(await supabase.from("projects").update(row).eq("id", id).select("id"));
    else pid = (unwrap(await supabase.from("projects").insert({ ...row, created_by: session.userId }).select("id").single()) as { id: string }).id;
    if (session.can("manage_projects")) {
      const leads = new Set(fd.getAll("leads").map(String));
      const team = fd.getAll("team").map(String).filter((x) => !leads.has(x));
      unwrap(await supabase.from("project_members").delete().eq("project_id", pid!).select("profile_id"));
      const members = [...[...leads].map((p) => ({ project_id: pid, profile_id: p, role: "responsabil" })), ...team.map((p) => ({ project_id: pid, profile_id: p, role: "membru" }))];
      if (members.length) unwrap(await supabase.from("project_members").insert(members).select("profile_id"));
    }
    // etape inițiale (doar la creare): un rând = o etapă, opțional „text | AAAA-LL-ZZ”
    if (!id) {
      const stages = str(fd, "stages").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [t, d] = l.split("|").map((x) => x.trim());
        return { project_id: pid, title: t, kind: "etapa", due_date: d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null };
      });
      if (stages.length) unwrap(await supabase.from("tasks").insert(stages).select("id"));
    }
    const files = validFiles(fd, "files");
    if (files.length) await uploadFiles(ctx, files, { category: "proiect", folder: "proiecte", project_id: pid });
    return { ok: true, message: id ? "Proiectul a fost actualizat." : "Proiectul a fost creat.", redirectTo: `/proiecte/${pid}` };
  });
}
export async function setProjectStatusAction(id: string, status: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("projects").update({ status }).eq("id", id).select("id")); return { ok: true, message: "Starea proiectului a fost actualizată." }; });
}
export async function deleteProjectAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("projects").delete().eq("id", id).select("id")); return { ok: true, message: "Proiectul a fost șters.", redirectTo: "/proiecte" }; });
}
export async function addTaskAction(projectId: string, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    unwrap(await supabase.from("tasks").insert({
      project_id: projectId, title: requireStr(fd, "title", "Titlul sarcinii"), description: optStr(fd, "description"), kind: str(fd, "kind") || "sarcina",
      assignee_id: optStr(fd, "assignee_id"), due_date: optStr(fd, "due_date"), created_by: session.userId,
    }).select("id"));
    return { ok: true, message: "Sarcina a fost adăugată." };
  });
}
export async function setTaskStatusAction(id: string, status: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("tasks").update({ status }).eq("id", id).select("id")); return { ok: true, message: "Starea sarcinii a fost actualizată." }; });
}
export async function deleteTaskAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("tasks").delete().eq("id", id).select("id")); return { ok: true, message: "Sarcina a fost ștearsă." }; });
}

export async function saveActivityAction(id: string | null, fd: FormData): Promise<ActionResult> {
  return runAction(async ({ supabase, session }) => {
    const ends = optStr(fd, "ends_at");
    const row = {
      title: requireStr(fd, "title", "Titlul activității"), description: optStr(fd, "description"), starts_at: localInputToIso(requireStr(fd, "starts_at", "Data și ora")),
      ends_at: ends ? localInputToIso(ends) : null, location: optStr(fd, "location"), responsible_id: optStr(fd, "responsible_id"), status: str(fd, "status") || "planificata",
    };
    if (row.ends_at && row.ends_at < row.starts_at) throw new ActionError("Ora de încheiere trebuie să fie după începere.");
    if (id) changed(await supabase.from("activities").update(row).eq("id", id).select("id"));
    else unwrap(await supabase.from("activities").insert({ ...row, created_by: session.userId }).select("id"));
    return { ok: true, message: id ? "Activitatea a fost actualizată." : "Activitatea a fost adăugată și apare în calendar." };
  });
}
export async function setActivityStatusAction(id: string, status: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("activities").update({ status }).eq("id", id).select("id")); return { ok: true, message: "Stadiul activității a fost actualizat." }; });
}
export async function deleteActivityAction(id: string): Promise<ActionResult> {
  return runAction(async ({ supabase }) => { changed(await supabase.from("activities").delete().eq("id", id).select("id")); return { ok: true, message: "Activitatea a fost ștearsă." }; });
}

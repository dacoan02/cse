import "server-only";
import { randomUUID } from "node:crypto";
import type { ActionContext } from "@/lib/action";
import { ActionError } from "@/lib/action";

const ALLOWED = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "txt", "csv", "png", "jpg", "jpeg"]);
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export interface UploadMeta {
  category: string; folder: string; visibility?: "toti" | "conducere" | "restrans"; title?: string; description?: string;
  meeting_id?: string | null; project_id?: string | null; activity_id?: string | null; feedback_id?: string | null; measure_id?: string | null; announcement_id?: string | null;
}

export function validFiles(fd: FormData, key: string): File[] {
  return fd.getAll(key).filter((f): f is File => f instanceof File && f.size > 0 && f.name !== "undefined");
}

/** Încarcă fișierele în bucket-ul privat „documents” și le înregistrează în tabelul documents. */
export async function uploadFiles(ctx: ActionContext, files: File[], meta: UploadMeta) {
  const inst = ctx.session.institution.id;
  const done: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED.has(ext)) throw new ActionError(`Tipul de fișier „.${ext}” nu este acceptat (${file.name}). Formate acceptate: PDF, DOC(X), XLS(X), PPT(X), ODT, ODS, TXT, CSV, PNG, JPG.`);
    if (file.size > MAX_FILE_BYTES) throw new ActionError(`Fișierul „${file.name}” depășește 15 MB.`);
    const safe = file.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${inst}/${meta.folder}/${randomUUID()}-${safe}`;
    const up = await ctx.supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (up.error) throw new ActionError(`Fișierul „${file.name}” nu a putut fi încărcat: ${up.error.message}`);
    const { error } = await ctx.supabase.from("documents").insert({
      title: meta.title && files.length === 1 ? meta.title : file.name.replace(/\.[^.]+$/, ""),
      description: meta.description ?? null, category: meta.category, storage_path: path, file_name: file.name,
      mime_type: file.type || null, size_bytes: file.size, visibility: meta.visibility ?? "toti",
      meeting_id: meta.meeting_id ?? null, project_id: meta.project_id ?? null, activity_id: meta.activity_id ?? null,
      feedback_id: meta.feedback_id ?? null, measure_id: meta.measure_id ?? null, announcement_id: meta.announcement_id ?? null, uploaded_by: ctx.session.userId,
    });
    if (error) { await ctx.supabase.storage.from("documents").remove([path]); throw new ActionError(error.message); }
    done.push(file.name);
  }
  return done;
}

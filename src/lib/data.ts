import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassRow } from "@/lib/types";

export async function getClasses(supabase: SupabaseClient, yearId: string | undefined): Promise<ClassRow[]> {
  if (!yearId) return [];
  const { data } = await supabase.from("classes").select("*").eq("school_year_id", yearId).order("name");
  return (data ?? []) as ClassRow[];
}

/** Nume + rol pentru toți membrii activi (atribuiri, autori). */
export async function getMembers(supabase: SupabaseClient): Promise<{ id: string; full_name: string; role: string }[]> {
  const { data } = await supabase.from("member_directory").select("id,full_name,role").order("full_name");
  return (data ?? []) as { id: string; full_name: string; role: string }[];
}

export function nameMap(rows: { id: string; full_name: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.id, r.full_name]));
}

export async function unreadAndNext(supabase: SupabaseClient) {
  const nowIso = new Date().toISOString();
  const { data } = await supabase.from("meetings").select("*").in("status", ["published", "in_progress"]).gte("starts_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .order("starts_at").limit(1);
  void nowIso;
  return data?.[0] ?? null;
}

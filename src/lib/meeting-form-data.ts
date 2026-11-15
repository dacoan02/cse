import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLE_LABEL } from "@/lib/labels";

export async function getMeetingFormData(supabase: SupabaseClient, yearId: string | undefined) {
  const [{ data: reps }, { data: members }] = await Promise.all([
    supabase.from("representatives").select("id,full_name,profile_id,classes(name)").eq("school_year_id", yearId ?? "").eq("status", "active").order("full_name"),
    supabase.from("member_directory").select("id,full_name,role").neq("role", "reprezentant").order("full_name"),
  ]);
  return {
    reps: (reps ?? []).map((r: any) => ({ id: r.id as string, name: r.full_name as string, cls: (r.classes?.name ?? "") as string, hasAccount: !!r.profile_id })),
    leaders: (members ?? []).map((m: any) => ({ id: m.id as string, name: m.full_name as string, roleLabel: ROLE_LABEL[m.role] })),
  };
}

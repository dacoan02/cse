import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RepParticipation { held: number; present: number; absent: number; noResponse: number; lastStatus: string | null; lastTitle: string | null; pct: number }

/** Participarea fiecărui reprezentant la ședințele DESFĂȘURATE din anul școlar curent (din date reale). */
export async function repParticipation(supabase: SupabaseClient, yearId: string | undefined): Promise<Map<string, RepParticipation>> {
  const out = new Map<string, RepParticipation>();
  if (!yearId) return out;
  const { data } = await supabase.from("meeting_participants")
    .select("representative_id,status,meetings!inner(title,status,starts_at,school_year_id)")
    .not("representative_id", "is", null).eq("meetings.status", "held").eq("meetings.school_year_id", yearId).limit(20000);
  const rows = (data ?? []) as any[];
  rows.sort((a, b) => +new Date(a.meetings.starts_at) - +new Date(b.meetings.starts_at));
  for (const r of rows) {
    const p = out.get(r.representative_id) ?? { held: 0, present: 0, absent: 0, noResponse: 0, lastStatus: null, lastTitle: null, pct: 0 };
    p.held++;
    if (r.status === "present" || r.status === "present_by_organizer") p.present++;
    else if (r.status === "absent") p.absent++;
    else p.noResponse++;
    p.lastStatus = r.status; p.lastTitle = r.meetings.title;
    p.pct = p.held ? Math.round((1000 * p.present) / p.held) / 10 : 0;
    out.set(r.representative_id, p);
  }
  return out;
}

export function avg(nums: number[]): number { return nums.length ? Math.round((10 * nums.reduce((a, b) => a + b, 0)) / nums.length) / 10 : 0; }

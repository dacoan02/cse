import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Rulează joburile programate (remindere pentru ședințe, deschiderea/închiderea automată a voturilor).
 * Apelează-l la fiecare minut din Vercel Cron / cron-job.org cu antetul `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const { data, error } = await createAdminClient().rpc("run_scheduled_jobs");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}

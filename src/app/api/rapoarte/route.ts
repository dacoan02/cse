import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/statistics";
import { buildReport } from "@/lib/report";
import { toCsv as csv, toPdf as pdf, toXlsx as xlsx } from "@/lib/report-files";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  if (!s.can("view_statistics") || !s.year) return NextResponse.json({ error: "Nu ai dreptul să generezi rapoarte." }, { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams) as Record<string, string>;
  const period = resolvePeriod(sp, s.year.starts_on);
  const supabase = await createClient();
  const { sections } = await buildReport(supabase, s.year.id, { from: period.from, to: period.to, classId: sp.clasa, repId: sp.reprezentant });
  const title = `Raport de activitate – ${s.institution.council_name}`;
  const meta = `${s.institution.name} · An școlar ${s.year.label} · Perioada: ${period.label} · Generat la ${new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}`;
  const base = `raport-activitate-${new Date().toISOString().slice(0, 10)}`;
  const format = sp.format ?? "pdf";
  const send = (body: BodyInit, type: string, ext: string) => new NextResponse(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${base}.${ext}"`, "Cache-Control": "no-store" } });
  if (format === "csv") return send(csv(sections), "text/csv; charset=utf-8", "csv");
  if (format === "xlsx") return send(new Uint8Array(await xlsx(sections, meta)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
  return send(new Uint8Array(await pdf(sections, title, meta)), "application/pdf", "pdf");
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function out(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("reason");
  return NextResponse.redirect(new URL(`/login${reason ? `?reason=${reason}` : ""}`, request.nextUrl.origin), { status: 303 });
}
export const GET = out;
export const POST = out;

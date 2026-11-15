import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Descărcare protejată: RLS decide dacă utilizatorul vede documentul; linkul semnat expiră în 60 s. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  const { data: doc } = await supabase.from("documents").select("storage_path,file_name").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Documentul nu există sau nu ai acces la el." }, { status: 404 });
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !data) return NextResponse.json({ error: "Fișierul nu a putut fi accesat." }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}

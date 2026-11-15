import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase pentru componente client (realtime, încărcări de fișiere, descărcări semnate). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client Supabase pentru server components, server actions și route handlers (cu sesiunea utilizatorului). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // apelat dintr-un Server Component: sesiunea este reîmprospătată în proxy.ts
          }
        },
      },
    },
  );
}

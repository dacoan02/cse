import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client cu cheia service_role: ocolește RLS. Se folosește DOAR pe server, după ce
 * apelantul a fost verificat (invitații, configurare inițială, ștergerea conturilor).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Lipsește SUPABASE_SERVICE_ROLE_KEY în variabilele de mediu.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

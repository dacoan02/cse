import "server-only";
import { getSession, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult<T = unknown> =
  | { ok: true; message?: string; redirectTo?: string; data?: T }
  | { ok: false; error: string };

export class ActionError extends Error {}

export interface ActionContext { session: Session; supabase: SupabaseClient }

/**
 * Împachetează o acțiune de server: verifică sesiunea, prinde erorile și le transformă în mesaje
 * ușor de înțeles. Mesajele `raise exception` din baza de date sunt deja în limba română.
 */
export async function runAction<T = unknown>(
  fn: (ctx: ActionContext) => Promise<ActionResult<T> | void>,
): Promise<ActionResult<T>> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Sesiunea a expirat. Autentifică-te din nou." };
    const supabase = await createClient();
    const result = await fn({ session, supabase });
    return result ?? { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export function friendlyError(e: unknown): string {
  if (e instanceof ActionError) return e.message;
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/row-level security|permission denied/i.test(msg)) return "Nu ai dreptul să efectuezi această acțiune.";
  if (/duplicate key|already exists/i.test(msg)) return "Există deja o înregistrare cu aceleași date.";
  if (/violates foreign key/i.test(msg)) return "Înregistrarea este folosită în altă parte și nu poate fi modificată sau ștearsă.";
  if (/violates check constraint/i.test(msg)) return "Unele date introduse nu sunt valide. Verifică formularul.";
  return msg;
}

/** Aruncă o eroare cu mesaj dacă interogarea Supabase a eșuat. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
export function requireStr(fd: FormData, key: string, label: string): string {
  const v = str(fd, key);
  if (!v) throw new ActionError(`Câmpul „${label}” este obligatoriu.`);
  return v;
}

/** Pentru UPDATE/DELETE cu .select(): dacă nu s-a modificat niciun rând, RLS a blocat operațiunea sau rândul nu există. */
export function changed<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  if (!res.data || res.data.length === 0) throw new ActionError("Nu ai dreptul să efectuezi această acțiune sau înregistrarea nu mai există.");
  return res.data;
}

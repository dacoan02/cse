import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPerm } from "@/lib/permissions";
import type { Institution, Perm, Profile, SchoolYear } from "@/lib/types";

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
  institution: Institution;
  year: SchoolYear | null;
  isPresident: boolean;
  isLeadership: boolean;
  can: (perm: Perm) => boolean;
}

/** Sesiunea curentă (memorată pe durata cererii). Returnează null dacă nu există utilizator valid. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (!profile) return null;
  if (!profile.is_active) return null;

  const [{ data: institution }, { data: year }] = await Promise.all([
    supabase.from("institutions").select("*").eq("id", profile.institution_id).single(),
    supabase.from("school_years").select("*").eq("institution_id", profile.institution_id).eq("is_current", true).maybeSingle(),
  ]);
  if (!institution) return null;

  const p = profile as Profile;
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    profile: p,
    institution: institution as Institution,
    year: (year as SchoolYear | null) ?? null,
    isPresident: p.role === "presedinte",
    isLeadership: p.role !== "reprezentant",
    can: (perm: Perm) => hasPerm(p, perm),
  };
});

/** Pentru pagini: redirecționează la autentificare dacă nu există sesiune validă. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/auth/signout?reason=session");
  return session;
}

/** Pentru pagini rezervate unui drept: redirecționează la dashboard dacă lipsește dreptul. */
export async function requirePerm(perm: Perm): Promise<Session> {
  const session = await requireSession();
  if (!session.can(perm)) redirect("/dashboard?acces=refuzat");
  return session;
}

export async function requirePresident(): Promise<Session> {
  const session = await requireSession();
  if (!session.isPresident) redirect("/dashboard?acces=refuzat");
  return session;
}

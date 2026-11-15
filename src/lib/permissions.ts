import type { Perm, Profile, Role } from "./types";

/** Oglindește public.perm_default() din baza de date. Baza de date rămâne sursa de adevăr (RLS). */
export function permDefault(role: Role, perm: Perm): boolean {
  switch (role) {
    case "presedinte": return true;
    case "secretar": return ["manage_documents", "edit_agenda", "view_statistics", "view_feedback", "manage_attendance"].includes(perm);
    case "vicepresedinte": return perm === "view_feedback";
    default: return false;
  }
}

export function hasPerm(profile: Pick<Profile, "role" | "permissions">, perm: Perm): boolean {
  if (profile.role === "presedinte") return true;
  if (profile.role === "reprezentant") return false;
  const override = profile.permissions?.[perm];
  return typeof override === "boolean" ? override : permDefault(profile.role, perm);
}

export function isLeadership(role: Role) { return role !== "reprezentant"; }

/** Drepturi configurabile de președinte pentru conducere (afișate în Setări). */
export const CONFIGURABLE_PERMS: { perm: Perm; label: string; hint: string }[] = [
  { perm: "manage_meetings", label: "Administrează ședințele", hint: "Creează, modifică, publică și încheie ședințe" },
  { perm: "manage_attendance", label: "Corectează prezența", hint: "Înregistrează prezența în numele participanților" },
  { perm: "edit_agenda", label: "Completează ordinea de zi", hint: "Adaugă și modifică punctele de pe ordinea de zi" },
  { perm: "manage_documents", label: "Gestionează documentele", hint: "Încarcă și categorisește documente" },
  { perm: "manage_votes", label: "Inițiază voturi", hint: "Creează și închide proceduri de vot" },
  { perm: "manage_projects", label: "Gestionează proiectele", hint: "Creează proiecte, activități și sarcini" },
  { perm: "manage_calendar", label: "Gestionează calendarul", hint: "Adaugă evenimente și termene-limită" },
  { perm: "manage_announcements", label: "Publică anunțuri", hint: "Publică, fixează și șterge anunțuri" },
  { perm: "view_feedback", label: "Vede sesizările", hint: "Acces la sesizările și propunerile primite" },
  { perm: "manage_feedback", label: "Administrează sesizările", hint: "Schimbă starea, atribuie și răspunde oficial" },
  { perm: "view_statistics", label: "Vede statisticile", hint: "Acces la secțiunea Statistici și rapoarte" },
  { perm: "view_audit", label: "Vede jurnalul de activitate", hint: "Acces la Istoric și activitate" },
  { perm: "manage_representatives", label: "Administrează Adunarea Generală", hint: "Adaugă și modifică reprezentanți și clase" },
];

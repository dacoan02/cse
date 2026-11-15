export type ToneName = "neutral" | "brand" | "ok" | "warn" | "bad";
export const MEETING_TONE: Record<string, ToneName> = { draft: "neutral", published: "brand", in_progress: "warn", held: "ok", cancelled: "bad" };
export const ATTENDANCE_TONE: Record<string, ToneName> = { no_response: "neutral", present: "ok", present_by_organizer: "ok", absent: "bad" };
export const FEEDBACK_TONE: Record<string, ToneName> = { nou: "brand", in_analiza: "warn", acceptat: "ok", in_solutionare: "warn", solutionat: "ok", respins: "bad" };
export const IMPORTANCE_TONE: Record<string, ToneName> = { scazut: "neutral", mediu: "brand", ridicat: "warn", urgent: "bad" };
export const PROJECT_TONE: Record<string, ToneName> = { in_pregatire: "neutral", aprobat: "brand", in_desfasurare: "warn", suspendat: "bad", finalizat: "ok", anulat: "bad" };
export const VOTE_TONE: Record<string, ToneName> = { draft: "neutral", programat: "brand", deschis: "warn", inchis: "ok" };

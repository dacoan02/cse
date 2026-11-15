export const ROLE_LABEL: Record<string, string> = {
  presedinte: "Președinte", secretar: "Secretar executiv", vicepresedinte: "Vicepreședinte", reprezentant: "Elev reprezentant",
};
export const ATTENDANCE_LABEL: Record<string, string> = {
  no_response: "Nu a răspuns", present: "Prezent", absent: "Absent", present_by_organizer: "Prezent (înregistrat de organizator)",
};
export const MEETING_STATUS_LABEL: Record<string, string> = {
  draft: "Ciornă", published: "Programată", in_progress: "În desfășurare", held: "Desfășurată", cancelled: "Anulată",
};
export const MEETING_TYPE_LABEL: Record<string, string> = { ordinara: "Ordinară", extraordinara: "Extraordinară" };
export const MODE_LABEL: Record<string, string> = { fizic: "Fizic", online: "Online", hibrid: "Hibrid" };
export const REP_STATUS_LABEL: Record<string, string> = { active: "Activ", inactive: "Inactiv", removed: "Eliminat" };
export const VOTE_TYPE_LABEL: Record<string, string> = {
  da_nu: "Da / Nu", da_nu_abtinere: "Da / Nu / Abținere", alegere_multipla: "Alegere dintre mai multe variante",
  desemnare_persoana: "Desemnarea unei persoane", consultativ: "Vot consultativ",
};
export const VOTE_STATUS_LABEL: Record<string, string> = { draft: "Ciornă", programat: "Programat", deschis: "Deschis", inchis: "Încheiat" };
export const FEEDBACK_KIND_LABEL: Record<string, string> = {
  problema: "Problemă identificată", sesizare: "Sesizare", propunere: "Propunere", idee_proiect: "Idee de proiect",
  solutie: "Soluție", alte_observatii: "Alte observații",
};
export const IMPORTANCE_LABEL: Record<string, string> = { scazut: "Scăzut", mediu: "Mediu", ridicat: "Ridicat", urgent: "Urgent" };
export const FEEDBACK_STATUS_LABEL: Record<string, string> = {
  nou: "Nou", in_analiza: "În analiză", acceptat: "Acceptat", in_solutionare: "În curs de soluționare", solutionat: "Soluționat", respins: "Respins",
};
export const PROJECT_CATEGORY_LABEL: Record<string, string> = {
  educational: "Proiecte educaționale", cultural: "Activități culturale", sportiv: "Activități sportive",
  voluntariat: "Proiecte de voluntariat", campanie: "Campanii de informare", reprezentare: "Activități de reprezentare",
  institutional: "Dezvoltare instituțională", evenimente: "Evenimente și parteneriate",
};
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  in_pregatire: "În pregătire", aprobat: "Aprobat", in_desfasurare: "În desfășurare", suspendat: "Suspendat", finalizat: "Finalizat", anulat: "Anulat",
};
export const ACTIVITY_STATUS_LABEL: Record<string, string> = { planificata: "Planificată", in_desfasurare: "În desfășurare", finalizata: "Finalizată", anulata: "Anulată" };
export const TASK_STATUS_LABEL: Record<string, string> = { de_facut: "De făcut", in_lucru: "În lucru", finalizat: "Finalizat" };
export const AUDIENCE_LABEL: Record<string, string> = { toti: "Întreaga Adunare Generală", conducere: "Doar conducerea", selectie: "Grup selectat" };
export const DOC_CATEGORY_LABEL: Record<string, string> = {
  convocator: "Convocatoare", proces_verbal: "Procese-verbale", ordine_zi: "Ordini de zi", hotarare: "Hotărâri și decizii",
  raport: "Rapoarte de activitate", regulament: "Regulamente", administrativ: "Documente administrative",
  proiect: "Documente ale proiectelor", altele: "Alte documente", atasament: "Atașamente",
};
export const MEASURE_LABEL: Record<string, string> = { mustrare: "Mustrare", avertisment: "Avertisment", demitere: "Procedură de demitere" };
export const PROCEDURE_LABEL: Record<string, string> = { initiata: "Inițiată", in_analiza: "În analiză", finalizata: "Finalizată", respinsa: "Respinsă" };
export const CALENDAR_KIND_LABEL: Record<string, string> = { eveniment: "Eveniment", termen_limita: "Termen-limită", altele: "Altele" };

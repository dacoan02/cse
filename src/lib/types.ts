// Tipuri scrise manual, oglindind schema din supabase/migrations/001_schema.sql
export type Role = "presedinte" | "secretar" | "vicepresedinte" | "reprezentant";

export type Perm =
  | "manage_meetings" | "manage_attendance" | "edit_agenda" | "manage_documents" | "manage_votes"
  | "manage_projects" | "manage_calendar" | "manage_announcements" | "view_feedback"
  | "manage_feedback" | "view_statistics" | "view_audit" | "manage_representatives";

export interface Institution {
  id: string; name: string; council_name: string; logo_path: string | null; primary_color: string;
  settings: { reminder_offsets_minutes?: number[] } & Record<string, unknown>;
}
export interface SchoolYear { id: string; institution_id: string; label: string; starts_on: string | null; ends_on: string | null; is_current: boolean; archived_at: string | null }
export interface Profile {
  id: string; institution_id: string; full_name: string; email: string | null; role: Role;
  is_active: boolean; permissions: Partial<Record<Perm, boolean>>; created_at: string;
}
export interface ClassRow { id: string; name: string; school_year_id: string; is_demo: boolean }
export interface Representative {
  id: string; institution_id: string; school_year_id: string; profile_id: string | null; full_name: string;
  class_id: string; position: string; email: string | null; status: "active" | "inactive" | "removed";
  mandate_start: string; mandate_end: string | null; notes: string | null; invited_at: string | null; is_demo: boolean;
}
export type MeetingStatus = "draft" | "published" | "in_progress" | "held" | "cancelled";
export type AttendanceStatus = "no_response" | "present" | "absent" | "present_by_organizer";
export interface Meeting {
  id: string; institution_id: string; school_year_id: string; title: string; meeting_type: "ordinara" | "extraordinara";
  starts_at: string; expected_end_at: string | null; location: string | null; mode: "fizic" | "online" | "hibrid";
  online_link: string | null; reason: string | null; description: string | null; status: MeetingStatus; archived: boolean;
  started_at: string | null; ended_at: string | null; decisions: string | null; cancelled_reason: string | null;
  q_total: number; q_required: number; q_present: number; q_absent: number; q_pending: number; q_met: boolean;
  is_demo: boolean; created_by: string | null;
}
export interface AgendaItem { id: string; meeting_id: string; position: number; title: string; description: string | null }
export interface Participant { id: string; meeting_id: string; representative_id: string | null; profile_id: string | null; status: AttendanceStatus; responded_at: string | null }
export interface DocumentRow {
  id: string; title: string; description: string | null; category: string; storage_path: string; file_name: string;
  mime_type: string | null; size_bytes: number | null; visibility: "toti" | "conducere" | "restrans";
  meeting_id: string | null; project_id: string | null; activity_id: string | null; feedback_id: string | null; announcement_id?: string | null;
  uploaded_by: string | null; created_at: string;
}
export interface Vote {
  id: string; meeting_id: string | null; title: string; question: string; description: string | null;
  vote_type: "da_nu" | "da_nu_abtinere" | "alegere_multipla" | "desemnare_persoana" | "consultativ";
  is_secret: boolean; show_interim: boolean; starts_at: string; ends_at: string;
  status: "draft" | "programat" | "deschis" | "inchis"; decision_text: string | null; result: VoteResult | null;
  closed_at: string | null; is_demo: boolean;
}
export interface VoteOption { id: string; vote_id: string; label: string; position: number; is_abstention: boolean }
export interface VoteTallyOption { id: string; label: string; is_abstention: boolean; count: number }
export interface VoteResult { eligible: number; voted: number; not_voted: number; participation_pct: number; options: VoteTallyOption[]; outcome: string; binding: boolean }
export interface VoteTally { status: string; is_secret: boolean; eligible: number; voted: number; not_voted: number; participation_pct: number; results_visible: boolean; options: VoteTallyOption[]; outcome: string | null }
export interface FeedbackItem {
  id: string; author_id: string; representative_id: string | null; kind: string; title: string; description: string;
  class_id: string | null; proposed_solution: string | null; importance: "scazut" | "mediu" | "ridicat" | "urgent";
  status: "nou" | "in_analiza" | "acceptat" | "in_solutionare" | "solutionat" | "respins";
  assigned_to: string | null; official_response: string | null; responded_at: string | null; resolved_at: string | null;
  created_at: string; is_demo: boolean;
}
export interface Project {
  id: string; title: string; description: string | null; objectives: string | null; category: string;
  starts_on: string | null; ends_on: string | null; location: string | null;
  status: "in_pregatire" | "aprobat" | "in_desfasurare" | "suspendat" | "finalizat" | "anulat"; notes: string | null; is_demo: boolean;
}
export interface Task {
  id: string; project_id: string | null; activity_id: string | null; title: string; description: string | null;
  kind: "sarcina" | "etapa"; assignee_id: string | null; due_date: string | null; status: "de_facut" | "in_lucru" | "finalizat";
}
export interface Activity {
  id: string; title: string; description: string | null; starts_at: string; ends_at: string | null; location: string | null;
  status: "planificata" | "in_desfasurare" | "finalizata" | "anulata"; responsible_id: string | null; is_demo: boolean;
}
export interface Announcement { id: string; title: string; content: string; author_id: string | null; audience: "toti" | "conducere" | "selectie"; pinned: boolean; published_at: string; is_demo: boolean }
export interface NotificationRow { id: string; type: string; title: string; body: string | null; link: string | null; is_read: boolean; is_archived: boolean; created_at: string }
export interface AdminMeasure {
  id: string; representative_id: string; kind: "mustrare" | "avertisment" | "demitere"; reason: string;
  description: string | null; applied_on: string; notes: string | null; procedure_status: string | null; created_by: string | null; created_at: string;
}
export interface AuditEntry { id: number; actor_name: string | null; action: string; entity_type: string; entity_id: string | null; summary: string | null; details: unknown; created_at: string }
export interface CalendarEvent { id: string; title: string; description: string | null; kind: string; starts_at: string; ends_at: string | null }

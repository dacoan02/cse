-- =====================================================================
-- CȘE – Platformă digitală pentru Consiliul Școlar al Elevilor
-- 001: Schema de bază (tabele, constrângeri, indexuri)
-- Toate datele sunt izolate pe instituție (institution_id).
-- =====================================================================
set check_function_bodies = off;

-- ---------- Instituții și ani școlari ----------
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  council_name text not null default 'Consiliul Școlar al Elevilor',
  logo_path text,
  primary_color text not null default '#1d4ed8' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  -- reminder_offsets_minutes: cu cât timp înainte de ședință se trimit remindere
  settings jsonb not null default '{"reminder_offsets_minutes":[1440,60,0]}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  label text not null,                       -- ex. 2026–2027
  starts_on date,
  ends_on date,
  is_current boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index school_years_one_current on public.school_years (institution_id) where is_current;

-- ---------- Utilizatori (legați de auth.users din Supabase) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  full_name text not null,
  email text,
  role text not null check (role in ('presedinte','secretar','vicepresedinte','reprezentant')),
  is_active boolean not null default true,
  -- drepturi suplimentare configurabile de președinte (ex. {"manage_projects": true})
  permissions jsonb not null default '{}'::jsonb,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_institution_idx on public.profiles (institution_id);

-- ---------- Adunarea Generală ----------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  name text not null,                        -- ex. IX A
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_year_id, name)
);

create table public.representatives (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  class_id uuid not null references public.classes(id) on delete restrict,
  position text not null default 'Reprezentant',
  email text,
  status text not null default 'active' check (status in ('active','inactive','removed')),
  mandate_start date not null default current_date,
  mandate_end date,
  notes text,
  invited_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- un reprezentant aparține unei singure clase în aceeași Adunare Generală
create unique index representatives_one_class_per_year
  on public.representatives (school_year_id, profile_id) where profile_id is not null;
create index representatives_year_status_idx on public.representatives (school_year_id, status);

-- ---------- Ședințe ----------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  title text not null,
  meeting_type text not null default 'ordinara' check (meeting_type in ('ordinara','extraordinara')),
  starts_at timestamptz not null,
  expected_end_at timestamptz,
  location text,
  mode text not null default 'fizic' check (mode in ('fizic','online','hibrid')),
  online_link text,
  reason text,
  description text,
  status text not null default 'draft' check (status in ('draft','published','in_progress','held','cancelled')),
  archived boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  decisions text,
  cancelled_reason text,
  -- cvorum (recalculat automat; modificabil doar prin funcții interne)
  q_total integer not null default 0,
  q_required integer not null default 1,
  q_present integer not null default 0,
  q_absent integer not null default 0,
  q_pending integer not null default 0,
  q_met boolean not null default false,
  quorum_reached_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_end_at is null or expected_end_at >= starts_at)
);
create index meetings_year_start_idx on public.meetings (school_year_id, starts_at);

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);
create index agenda_items_meeting_idx on public.agenda_items (meeting_id, position);

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  representative_id uuid references public.representatives(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'no_response'
    check (status in ('no_response','present','absent','present_by_organizer')),
  responded_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (representative_id is not null or profile_id is not null),
  unique (meeting_id, representative_id),
  unique (meeting_id, profile_id)
);
create index meeting_participants_profile_idx on public.meeting_participants (profile_id);

-- Situația finală a prezenței, păstrată la încheierea ședinței
create table public.meeting_attendance_snapshot (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  representative_id uuid references public.representatives(id) on delete set null,
  full_name text not null,
  class_name text,
  status text not null check (status in ('no_response','present','absent','present_by_organizer')),
  unique (meeting_id, representative_id)
);

create table public.meeting_reminders (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  offset_minutes integer not null,
  sent_at timestamptz not null default now(),
  primary key (meeting_id, offset_minutes)
);

-- ---------- Propuneri și sesizări ----------
create table public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  representative_id uuid references public.representatives(id) on delete set null,
  kind text not null check (kind in ('problema','sesizare','propunere','idee_proiect','solutie','alte_observatii')),
  title text not null,
  description text not null,
  class_id uuid references public.classes(id) on delete set null,
  proposed_solution text,
  importance text not null default 'mediu' check (importance in ('scazut','mediu','ridicat','urgent')),
  status text not null default 'nou'
    check (status in ('nou','in_analiza','acceptat','in_solutionare','solutionat','respins')),
  assigned_to uuid references public.profiles(id) on delete set null,
  official_response text,
  responded_at timestamptz,
  resolved_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_status_idx on public.feedback_items (institution_id, status);

create table public.feedback_notes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  feedback_id uuid not null references public.feedback_items(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- Proiecte, activități, sarcini ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  title text not null,
  description text,
  objectives text,
  category text not null default 'educational' check (category in (
    'educational','cultural','sportiv','voluntariat','campanie','reprezentare','institutional','evenimente')),
  starts_on date,
  ends_on date,
  location text,
  status text not null default 'in_pregatire'
    check (status in ('in_pregatire','aprobat','in_desfasurare','suspendat','finalizat','anulat')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'membru' check (role in ('responsabil','membru')),
  primary key (project_id, profile_id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  status text not null default 'planificata'
    check (status in ('planificata','in_desfasurare','finalizata','anulata')),
  responsible_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'sarcina' check (kind in ('sarcina','etapa')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'de_facut' check (status in ('de_facut','in_lucru','finalizat')),
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (project_id is not null or activity_id is not null)
);
create index tasks_project_idx on public.tasks (project_id);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'eveniment' check (kind in ('eveniment','termen_limita','altele')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Voturi ----------
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  title text not null,
  question text not null,
  description text,
  vote_type text not null check (vote_type in (
    'da_nu','da_nu_abtinere','alegere_multipla','desemnare_persoana','consultativ')),
  is_secret boolean not null default false,
  show_interim boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','programat','deschis','inchis')),
  decision_text text,
  result jsonb,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.vote_options (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  is_abstention boolean not null default false
);

create table public.vote_eligible (
  vote_id uuid not null references public.votes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (vote_id, profile_id)
);

-- Cine a votat (fără conținutul votului)
create table public.vote_participation (
  vote_id uuid not null references public.votes(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (vote_id, profile_id)
);

-- Buletinele de vot. La vot secret profile_id și cast_at rămân NULL,
-- deci nu există nicio legătură între votant și opțiunea aleasă.
create table public.ballots (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes(id) on delete cascade,
  option_id uuid not null references public.vote_options(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  cast_at timestamptz
);
create unique index ballots_one_public_per_user on public.ballots (vote_id, profile_id) where profile_id is not null;
create index ballots_vote_idx on public.ballots (vote_id);

-- ---------- Măsuri administrative ----------
create table public.admin_measures (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  representative_id uuid not null references public.representatives(id) on delete restrict,
  kind text not null check (kind in ('mustrare','avertisment','demitere')),
  reason text not null,
  description text,
  applied_on date not null default current_date,
  notes text,
  procedure_status text check (procedure_status in ('initiata','in_analiza','finalizata','respinsa')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'demitere') = (procedure_status is not null))
);

-- ---------- Documente ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'altele' check (category in (
    'convocator','proces_verbal','ordine_zi','hotarare','raport','regulament',
    'administrativ','proiect','atasament','altele')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  -- toti | conducere | restrans (autor + conducere cu drept de vizualizare a sesizărilor)
  visibility text not null default 'toti' check (visibility in ('toti','conducere','restrans')),
  meeting_id uuid references public.meetings(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  feedback_id uuid references public.feedback_items(id) on delete cascade,
  measure_id uuid references public.admin_measures(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index documents_meeting_idx on public.documents (meeting_id);

-- ---------- Anunțuri ----------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  content text not null,
  author_id uuid references public.profiles(id) on delete set null,
  audience text not null default 'toti' check (audience in ('toti','conducere','selectie')),
  pinned boolean not null default false,
  is_demo boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.announcement_recipients (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (announcement_id, profile_id)
);

-- ---------- Notificări ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, is_archived, is_read, created_at desc);

-- ---------- Jurnal de activitate (doar adăugare) ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  institution_id uuid references public.institutions(id) on delete cascade,
  actor_id uuid,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_inst_idx on public.audit_log (institution_id, created_at desc);

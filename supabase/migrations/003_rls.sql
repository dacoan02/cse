-- =====================================================================
-- 003: Securitate – RLS pe rol, view-uri, permisiuni, stocare, realtime
-- Principiu: fără acces implicit. Scrierile sensibile trec prin funcții RPC.
-- =====================================================================
set check_function_bodies = off;

-- ---------- Funcții pentru politici ----------
create or replace function public.can_read_doc(d public.documents) returns boolean
language sql stable security definer set search_path = public as $$
  select d.institution_id = public.auth_institution() and (
    public.is_president()
    or d.uploaded_by = auth.uid()
    or (d.visibility = 'toti' and (
          d.meeting_id is null
          or public.is_leadership()
          or exists (select 1 from public.meeting_participants mp join public.meetings m on m.id = mp.meeting_id
                      where mp.meeting_id = d.meeting_id and mp.profile_id = auth.uid() and m.status <> 'draft')))
    or (d.visibility = 'conducere' and public.is_leadership())
    or (d.visibility = 'restrans' and public.has_perm('view_feedback'))
  )
$$;

create or replace function public.can_read_doc_path(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documents d where d.storage_path = p_path and public.can_read_doc(d))
$$;

-- ---------- Activare RLS ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Instituții, ani, profiluri, clase ----------
create policy institutions_select on public.institutions for select to authenticated
  using (id = public.auth_institution());
create policy institutions_update on public.institutions for update to authenticated
  using (id = public.auth_institution() and public.is_president())
  with check (id = public.auth_institution() and public.is_president());

create policy school_years_select on public.school_years for select to authenticated
  using (institution_id = public.auth_institution());
create policy school_years_write on public.school_years for update to authenticated
  using (institution_id = public.auth_institution() and public.is_president())
  with check (institution_id = public.auth_institution() and public.is_president());

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or (institution_id = public.auth_institution() and public.is_leadership()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or (institution_id = public.auth_institution() and public.is_president()))
  with check (institution_id = public.auth_institution());

create policy classes_select on public.classes for select to authenticated
  using (institution_id = public.auth_institution());
create policy classes_write on public.classes for all to authenticated
  using (institution_id = public.auth_institution() and (public.is_president() or public.has_perm('manage_representatives')))
  with check (institution_id = public.auth_institution() and (public.is_president() or public.has_perm('manage_representatives')));

-- ---------- Reprezentanți ----------
create policy representatives_select on public.representatives for select to authenticated
  using (institution_id = public.auth_institution() and (public.is_leadership() or profile_id = auth.uid()));
create policy representatives_write on public.representatives for all to authenticated
  using (institution_id = public.auth_institution() and (public.is_president() or public.has_perm('manage_representatives')))
  with check (institution_id = public.auth_institution() and (public.is_president() or public.has_perm('manage_representatives')));

-- ---------- Ședințe ----------
create policy meetings_select on public.meetings for select to authenticated
  using (institution_id = public.auth_institution() and (
    public.is_leadership()
    or (status <> 'draft' and exists (select 1 from public.meeting_participants mp
                                       where mp.meeting_id = meetings.id and mp.profile_id = auth.uid()))));
create policy meetings_insert on public.meetings for insert to authenticated
  with check (institution_id = public.auth_institution() and public.can_manage_meetings());
create policy meetings_update on public.meetings for update to authenticated
  using (institution_id = public.auth_institution() and public.can_manage_meetings())
  with check (institution_id = public.auth_institution() and public.can_manage_meetings());
create policy meetings_delete on public.meetings for delete to authenticated
  using (institution_id = public.auth_institution() and public.can_manage_meetings() and status = 'draft');

create policy agenda_select on public.agenda_items for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = agenda_items.meeting_id));
create policy agenda_write on public.agenda_items for all to authenticated
  using (exists (select 1 from public.meetings m where m.id = agenda_items.meeting_id)
         and (public.can_manage_meetings() or public.has_perm('edit_agenda')))
  with check (exists (select 1 from public.meetings m where m.id = agenda_items.meeting_id)
              and (public.can_manage_meetings() or public.has_perm('edit_agenda')));

create policy participants_select on public.meeting_participants for select to authenticated
  using (institution_id = public.auth_institution() and (public.is_leadership() or profile_id = auth.uid()));

create policy snapshot_select on public.meeting_attendance_snapshot for select to authenticated
  using (institution_id = public.auth_institution() and (
    public.is_leadership()
    or exists (select 1 from public.representatives r
                where r.id = meeting_attendance_snapshot.representative_id and r.profile_id = auth.uid())));

-- ---------- Documente ----------
create policy documents_select on public.documents for select to authenticated
  using (public.can_read_doc(documents));
create policy documents_insert on public.documents for insert to authenticated
  with check (institution_id = public.auth_institution() and uploaded_by = auth.uid() and (
    public.has_perm('manage_documents')
    or (feedback_id is not null and visibility = 'restrans'
        and exists (select 1 from public.feedback_items f where f.id = feedback_id and f.author_id = auth.uid()))));
create policy documents_update on public.documents for update to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('manage_documents'))
  with check (institution_id = public.auth_institution() and public.has_perm('manage_documents'));
create policy documents_delete on public.documents for delete to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('manage_documents'));

-- ---------- Voturi (scrierile trec prin RPC) ----------
create policy votes_select on public.votes for select to authenticated
  using (institution_id = public.auth_institution() and (
    public.has_perm('manage_votes')
    or (status <> 'draft' and (public.is_leadership()
        or exists (select 1 from public.vote_eligible e where e.vote_id = votes.id and e.profile_id = auth.uid())))));
create policy votes_update on public.votes for update to authenticated
  using (institution_id = public.auth_institution() and public.can_manage_votes())
  with check (institution_id = public.auth_institution() and public.can_manage_votes());

create policy vote_options_select on public.vote_options for select to authenticated
  using (exists (select 1 from public.votes v where v.id = vote_options.vote_id));

create policy vote_eligible_select on public.vote_eligible for select to authenticated
  using (profile_id = auth.uid() or public.is_leadership());
create policy vote_participation_select on public.vote_participation for select to authenticated
  using (profile_id = auth.uid() or public.is_leadership());
-- ballots: fără politici => inaccesibil direct; rezultatele se citesc doar prin vote_tally()

-- ---------- Sesizări ----------
create policy feedback_select on public.feedback_items for select to authenticated
  using (institution_id = public.auth_institution() and (
    author_id = auth.uid() or assigned_to = auth.uid() or public.has_perm('view_feedback')));
create policy feedback_insert on public.feedback_items for insert to authenticated
  with check (institution_id = public.auth_institution() and author_id = auth.uid()
              and status = 'nou' and assigned_to is null and official_response is null);
create policy feedback_update on public.feedback_items for update to authenticated
  using (institution_id = public.auth_institution() and (public.has_perm('manage_feedback') or assigned_to = auth.uid()))
  with check (institution_id = public.auth_institution() and (public.has_perm('manage_feedback') or assigned_to = auth.uid()));

create policy feedback_notes_select on public.feedback_notes for select to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('view_feedback'));
create policy feedback_notes_insert on public.feedback_notes for insert to authenticated
  with check (institution_id = public.auth_institution() and author_id = auth.uid() and (
    public.has_perm('manage_feedback')
    or exists (select 1 from public.feedback_items f where f.id = feedback_id and f.assigned_to = auth.uid())));

-- ---------- Proiecte, activități, sarcini, calendar ----------
create policy projects_select on public.projects for select to authenticated
  using (institution_id = public.auth_institution());
create policy projects_insert on public.projects for insert to authenticated
  with check (institution_id = public.auth_institution() and public.has_perm('manage_projects'));
create policy projects_update on public.projects for update to authenticated
  using (institution_id = public.auth_institution() and (public.has_perm('manage_projects')
    or exists (select 1 from public.project_members pm where pm.project_id = projects.id
                and pm.profile_id = auth.uid() and pm.role = 'responsabil')))
  with check (institution_id = public.auth_institution());
create policy projects_delete on public.projects for delete to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('manage_projects'));

create policy project_members_select on public.project_members for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_members.project_id));
create policy project_members_write on public.project_members for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_members.project_id) and public.has_perm('manage_projects'))
  with check (exists (select 1 from public.projects p where p.id = project_members.project_id) and public.has_perm('manage_projects'));

create policy activities_select on public.activities for select to authenticated
  using (institution_id = public.auth_institution());
create policy activities_insert on public.activities for insert to authenticated
  with check (institution_id = public.auth_institution() and public.has_perm('manage_projects'));
create policy activities_update on public.activities for update to authenticated
  using (institution_id = public.auth_institution() and (public.has_perm('manage_projects') or responsible_id = auth.uid()))
  with check (institution_id = public.auth_institution());
create policy activities_delete on public.activities for delete to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('manage_projects'));

create policy tasks_select on public.tasks for select to authenticated
  using (institution_id = public.auth_institution());
create policy tasks_insert on public.tasks for insert to authenticated
  with check (institution_id = public.auth_institution() and (public.has_perm('manage_projects')
    or exists (select 1 from public.project_members pm where pm.project_id = tasks.project_id
                and pm.profile_id = auth.uid() and pm.role = 'responsabil')));
create policy tasks_update on public.tasks for update to authenticated
  using (institution_id = public.auth_institution() and (public.has_perm('manage_projects') or assignee_id = auth.uid()
    or exists (select 1 from public.project_members pm where pm.project_id = tasks.project_id
                and pm.profile_id = auth.uid() and pm.role = 'responsabil')))
  with check (institution_id = public.auth_institution());
create policy tasks_delete on public.tasks for delete to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('manage_projects'));

create policy calendar_select on public.calendar_events for select to authenticated
  using (institution_id = public.auth_institution());
create policy calendar_write on public.calendar_events for all to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('manage_calendar'))
  with check (institution_id = public.auth_institution() and public.has_perm('manage_calendar'));

-- ---------- Anunțuri ----------
create policy announcements_select on public.announcements for select to authenticated
  using (institution_id = public.auth_institution() and (
    audience = 'toti' or author_id = auth.uid() or public.has_perm('manage_announcements')
    or (audience = 'conducere' and public.is_leadership())
    or (audience = 'selectie' and exists (select 1 from public.announcement_recipients r
                                           where r.announcement_id = announcements.id and r.profile_id = auth.uid()))));
create policy announcements_update on public.announcements for update to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('manage_announcements'))
  with check (institution_id = public.auth_institution() and public.has_perm('manage_announcements'));
create policy announcements_delete on public.announcements for delete to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('manage_announcements'));
create policy announcement_recipients_select on public.announcement_recipients for select to authenticated
  using (profile_id = auth.uid() or public.has_perm('manage_announcements'));

-- ---------- Notificări ----------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Măsuri administrative, jurnal ----------
create policy measures_select on public.admin_measures for select to authenticated
  using (institution_id = public.auth_institution() and (public.is_president()
    or exists (select 1 from public.representatives r where r.id = admin_measures.representative_id and r.profile_id = auth.uid())));
create policy measures_insert on public.admin_measures for insert to authenticated
  with check (institution_id = public.auth_institution() and public.is_president() and created_by = auth.uid());
create policy measures_update on public.admin_measures for update to authenticated
  using (institution_id = public.auth_institution() and public.is_president())
  with check (institution_id = public.auth_institution() and public.is_president());

create policy audit_select on public.audit_log for select to authenticated
  using (institution_id = public.auth_institution() and public.has_perm('view_audit'));

-- ---------- View-uri sigure ----------
-- Lista publică a Adunării Generale (fără e-mail și observații administrative)
create view public.assembly_directory as
  select r.id, r.institution_id, r.school_year_id, r.profile_id, r.full_name, r.class_id,
         c.name as class_name, r.position, r.status, r.mandate_start
    from public.representatives r
    join public.classes c on c.id = r.class_id
   where r.institution_id = public.auth_institution() and r.status = 'active';

-- Numele și rolurile membrilor instituției (pentru atribuiri și afișarea autorilor)
create view public.member_directory as
  select p.id, p.institution_id, p.full_name, p.role
    from public.profiles p
   where p.institution_id = public.auth_institution() and p.is_active;

-- ---------- Permisiuni de bază ----------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public, anon;
revoke insert, update, delete on public.audit_log, public.ballots, public.vote_participation,
  public.vote_eligible, public.meeting_participants, public.meeting_attendance_snapshot,
  public.meeting_reminders, public.announcement_recipients from authenticated;
revoke insert on public.votes from authenticated;
revoke insert on public.announcements from authenticated;
revoke delete on public.votes from authenticated;
revoke update on public.notifications from authenticated;
grant update (is_read, is_archived) on public.notifications to authenticated;
revoke delete on public.admin_measures, public.notifications, public.profiles, public.institutions from authenticated;
revoke insert on public.profiles, public.institutions, public.school_years from authenticated;
revoke delete on public.school_years from authenticated;

grant select on public.assembly_directory, public.member_directory to authenticated;

-- Funcții folosite de politici și triggere (rulează cu drepturile apelantului)
grant execute on function
  public.auth_institution(), public.auth_role(), public.is_president(), public.is_leadership(),
  public.has_perm(text), public.perm_default(text, text), public.current_year_id(), public.app_internal(),
  public.quorum_threshold(integer), public.can_manage_meetings(), public.can_manage_votes(),
  public.can_read_doc(public.documents), public.can_read_doc_path(text)
  to authenticated;

-- RPC-uri expuse aplicației
grant execute on function
  public.set_meeting_recipients(uuid, boolean, uuid[], uuid[]), public.publish_meeting(uuid),
  public.start_meeting(uuid), public.cancel_meeting(uuid, text), public.finish_meeting(uuid, timestamptz, text),
  public.announce_agenda(uuid), public.set_attendance(uuid, text), public.set_attendance_for(uuid, text),
  public.create_vote(jsonb), public.close_vote(uuid), public.cast_vote(uuid, uuid), public.vote_tally(uuid),
  public.vote_public_choices(uuid), public.publish_announcement(text, text, text, boolean, uuid[]),
  public.start_new_school_year(text, date, date, boolean), public.seed_demo_data(), public.clear_demo_data(),
  public.run_scheduled_jobs()
  to authenticated;

grant execute on all functions in schema public to service_role;

-- ---------- Stocare fișiere (bucket privat) ----------
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_read_doc_path(name));
create policy documents_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_institution()::text
    and (public.has_perm('manage_documents') or (storage.foldername(name))[2] = 'feedback'));
create policy documents_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_institution()::text
    and public.has_perm('manage_documents'));

-- ---------- Realtime ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['meetings','meeting_participants','notifications','votes','vote_participation',
        'feedback_items','announcements','projects','tasks'] loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;

-- ---------- Joburi programate (opțional, dacă extensia pg_cron este activată) ----------
-- select cron.schedule('cse-jobs', '* * * * *', $$select public.run_scheduled_jobs()$$);

-- =====================================================================
-- 002: Funcții ajutătoare, reguli de business (cvorum, vot, notificări)
-- =====================================================================
set check_function_bodies = off;

-- ---------- Context utilizator ----------
create or replace function public.auth_institution() returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_president() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'presedinte' from public.profiles where id = auth.uid() and is_active), false)
$$;

create or replace function public.is_leadership() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('presedinte','secretar','vicepresedinte')
                   from public.profiles where id = auth.uid() and is_active), false)
$$;

-- Drepturi implicite pe rol (pot fi suprascrise de președinte în profiles.permissions)
create or replace function public.perm_default(p_role text, p_perm text) returns boolean
language sql immutable as $$
  select case p_role
    when 'presedinte' then true
    when 'secretar' then p_perm in
      ('manage_documents','edit_agenda','view_statistics','view_feedback','manage_attendance')
    when 'vicepresedinte' then p_perm in ('view_feedback')
    else false
  end
$$;

-- Drepturi posibile: manage_meetings, manage_attendance, edit_agenda, manage_documents,
-- manage_votes, manage_projects, manage_calendar, manage_announcements, view_feedback,
-- manage_feedback, view_statistics, view_audit, manage_representatives
create or replace function public.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when role = 'presedinte' then true
      when role = 'reprezentant' then false
      when jsonb_exists(permissions, p_perm) then (permissions ->> p_perm)::boolean
      else public.perm_default(role, p_perm)
    end
    from public.profiles where id = auth.uid() and is_active
  ), false)
$$;

create or replace function public.perm_holders(p_inst uuid, p_perm text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles
  where institution_id = p_inst and is_active and role <> 'reprezentant'
    and (role = 'presedinte'
         or coalesce(case when jsonb_exists(permissions, p_perm) then (permissions ->> p_perm)::boolean end,
                     public.perm_default(role, p_perm)))
$$;

create or replace function public.current_year_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.school_years
  where institution_id = public.auth_institution() and is_current
$$;

create or replace function public.app_internal() returns boolean
language sql stable as $$ select coalesce(current_setting('app.internal', true), '') = 'on' $$;

create or replace function public.quorum_threshold(p_total integer) returns integer
language sql immutable as $$ select (greatest(p_total, 0) / 2) + 1 $$;

-- Valori implicite: institution_id și school_year_id din contextul utilizatorului
do $$
declare r record;
begin
  for r in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'institution_id'
             and table_name <> 'institutions' and table_name <> 'audit_log' loop
    execute format('alter table public.%I alter column institution_id set default public.auth_institution()', r.table_name);
  end loop;
  for r in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'school_year_id'
             and table_name in ('classes','representatives','meetings','feedback_items','projects','activities','votes') loop
    execute format('alter table public.%I alter column school_year_id set default public.current_year_id()', r.table_name);
  end loop;
end $$;

-- ---------- Notificări și jurnal (interne) ----------
create or replace function public.notify_users(
  p_inst uuid, p_users uuid[], p_type text, p_title text, p_body text, p_link text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_users is null or array_length(p_users, 1) is null then return; end if;
  insert into public.notifications (institution_id, user_id, type, title, body, link)
  select p_inst, p.id, p_type, p_title, p_body, p_link
  from public.profiles p
  where p.id = any (p_users) and p.institution_id = p_inst and p.is_active
    and p.id is distinct from auth.uid();
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.prevent_modification() returns trigger
language plpgsql as $$
begin
  raise exception 'Înregistrările din jurnal și măsurile administrative nu pot fi șterse sau rescrise.';
end $$;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb; v_old jsonb; v_diff jsonb; v_action text; v_inst uuid; v_id uuid;
  v_title text; v_actor uuid := auth.uid(); v_name text;
begin
  if TG_OP = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  v_id := (v_row ->> 'id')::uuid;
  v_inst := coalesce((v_row ->> 'institution_id')::uuid, case when TG_TABLE_NAME = 'institutions' then v_id end);
  v_title := coalesce(v_row ->> 'title', v_row ->> 'full_name', v_row ->> 'name', v_row ->> 'label');
  v_action := TG_TABLE_NAME || '.' || lower(TG_OP);

  if TG_OP = 'UPDATE' then
    v_old := to_jsonb(old);
    select jsonb_object_agg(n.key, jsonb_build_object('de', o.value, 'la', n.value)) into v_diff
    from jsonb_each(v_row) n join jsonb_each(v_old) o on o.key = n.key
    where n.value is distinct from o.value
      and n.key not in ('updated_at','q_total','q_required','q_present','q_absent','q_pending','q_met','quorum_reached_at');
    if v_diff is null then return null; end if;
    if TG_TABLE_NAME in ('meetings','votes','feedback_items','projects')
       and v_old ->> 'status' is distinct from v_row ->> 'status' then
      v_action := TG_TABLE_NAME || '.' || (v_row ->> 'status');
    end if;
    if TG_TABLE_NAME = 'profiles' and v_old ->> 'role' is distinct from v_row ->> 'role' then
      v_action := 'profiles.role_changed';
    elsif TG_TABLE_NAME = 'profiles' and v_old ->> 'is_active' is distinct from v_row ->> 'is_active' then
      v_action := 'profiles.active_changed';
    end if;
  elsif TG_OP = 'INSERT' then
    v_diff := null;
  else
    v_diff := v_row;
  end if;

  select full_name into v_name from public.profiles where id = v_actor;
  insert into public.audit_log (institution_id, actor_id, actor_name, action, entity_type, entity_id, summary, details)
  values (v_inst, v_actor, coalesce(v_name, case when v_actor is null then 'Sistem' end), v_action,
          TG_TABLE_NAME, v_id, v_title, v_diff);
  return null;
end $$;

-- ---------- Gărzi de integritate ----------
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.institution_id <> old.institution_id then
    raise exception 'Un cont nu poate fi mutat în altă instituție.';
  end if;
  if auth.uid() is not null and not public.is_president() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active
       or new.permissions is distinct from old.permissions then
      raise exception 'Nu poți modifica rolul, statutul sau drepturile unui cont.';
    end if;
  end if;
  if old.role = 'presedinte' and old.is_active and (new.role <> 'presedinte' or not new.is_active) then
    if not exists (select 1 from public.profiles
                   where institution_id = old.institution_id and role = 'presedinte'
                     and is_active and id <> old.id) then
      raise exception 'Trebuie să existe cel puțin un președinte activ.';
    end if;
  end if;
  if old.is_active and not new.is_active then new.deactivated_at := now(); end if;
  if not old.is_active and new.is_active then new.deactivated_at := null; end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.meetings_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not public.app_internal() then
    if TG_OP = 'INSERT' then
      new.status := 'draft'; new.q_total := 0; new.q_required := 1; new.q_present := 0;
      new.q_absent := 0; new.q_pending := 0; new.q_met := false; new.published_at := null;
      new.started_at := null; new.ended_at := null; new.quorum_reached_at := null;
    else
      if new.status is distinct from old.status or new.q_total is distinct from old.q_total
         or new.q_required is distinct from old.q_required or new.q_present is distinct from old.q_present
         or new.q_absent is distinct from old.q_absent or new.q_pending is distinct from old.q_pending
         or new.q_met is distinct from old.q_met or new.started_at is distinct from old.started_at
         or new.ended_at is distinct from old.ended_at or new.published_at is distinct from old.published_at then
        raise exception 'Starea ședinței și cvorumul se modifică doar prin acțiunile dedicate.';
      end if;
      if old.status in ('held','cancelled')
         and (to_jsonb(new) - 'archived' - 'decisions' - 'updated_at')
             is distinct from (to_jsonb(old) - 'archived' - 'decisions' - 'updated_at') then
        raise exception 'O ședință încheiată sau anulată nu mai poate fi modificată (se poate doar arhiva).';
      end if;
    end if;
  end if;
  if TG_OP = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end $$;

create or replace function public.votes_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not public.app_internal() then
    if TG_OP = 'INSERT' then
      raise exception 'Voturile se creează prin funcția dedicată.';
    end if;
    if (to_jsonb(new) - 'meeting_id' - 'decision_text') is distinct from (to_jsonb(old) - 'meeting_id' - 'decision_text') then
      raise exception 'Un vot nu mai poate fi modificat după creare; pot fi atașate doar ședința și decizia.';
    end if;
  end if;
  return new;
end $$;

create or replace function public.measures_guard() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Măsurile administrative nu pot fi șterse; se păstrează în istoric.';
  end if;
  if (to_jsonb(new) - 'procedure_status' - 'notes') is distinct from (to_jsonb(old) - 'procedure_status' - 'notes') then
    raise exception 'O măsură înregistrată nu poate fi rescrisă; se pot actualiza doar starea procedurii și observațiile.';
  end if;
  if old.kind <> 'demitere' and new.procedure_status is distinct from old.procedure_status then
    raise exception 'Doar procedurile de demitere au stare.';
  end if;
  return new;
end $$;

create or replace function public.feedback_before_update() returns trigger
language plpgsql as $$
begin
  if new.status = 'solutionat' and old.status <> 'solutionat' then new.resolved_at := now(); end if;
  if new.status <> 'solutionat' then new.resolved_at := null; end if;
  if new.official_response is distinct from old.official_response and new.official_response is not null then
    new.responded_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.tasks_before_update() returns trigger
language plpgsql as $$
begin
  if new.status = 'finalizat' and old.status <> 'finalizat' then new.completed_at := now(); end if;
  if new.status <> 'finalizat' then new.completed_at := null; end if;
  return new;
end $$;

-- ---------- Cvorum ----------
create or replace function public.recompute_quorum(p_meeting uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.meetings; v_total int; v_present int; v_absent int; v_req int; v_met boolean;
begin
  select * into m from public.meetings where id = p_meeting;
  if not found or m.status in ('held','cancelled') then return; end if;

  select count(*) into v_total from public.representatives
   where school_year_id = m.school_year_id and status = 'active';

  select count(*) filter (where p.status in ('present','present_by_organizer')),
         count(*) filter (where p.status = 'absent')
    into v_present, v_absent
    from public.meeting_participants p
    join public.representatives r on r.id = p.representative_id
   where p.meeting_id = p_meeting and r.status = 'active';

  v_req := public.quorum_threshold(v_total);
  v_met := v_total > 0 and v_present >= v_req;

  perform set_config('app.internal', 'on', true);
  update public.meetings set
    q_total = v_total, q_required = v_req, q_present = v_present, q_absent = v_absent,
    q_pending = greatest(v_total - v_present - v_absent, 0), q_met = v_met,
    quorum_reached_at = case when v_met and not m.q_met then now()
                             when not v_met then null else m.quorum_reached_at end
  where id = p_meeting;
  perform set_config('app.internal', 'off', true);

  if v_met and not m.q_met and m.status in ('published','in_progress') then
    perform public.notify_users(m.institution_id,
      array(select public.perm_holders(m.institution_id, 'manage_meetings')),
      'quorum_reached', 'Cvorum întrunit',
      format('La ședința „%s” s-a atins cvorumul (%s din %s necesari).', m.title, v_present, v_req),
      '/sedinte/' || m.id);
  end if;
end $$;

create or replace function public.participants_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recompute_quorum(old.meeting_id);
  else
    perform public.recompute_quorum(new.meeting_id);
  end if;
  return null;
end $$;

create or replace function public.representatives_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; v_year uuid;
begin
  v_year := coalesce(case when TG_OP = 'DELETE' then old.school_year_id else new.school_year_id end, null);
  for m in select id from public.meetings
           where school_year_id = v_year and status in ('published','in_progress') loop
    perform public.recompute_quorum(m.id);
  end loop;
  return null;
end $$;

create or replace function public.audit_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_actor_name text;
begin
  if new.status is not distinct from old.status then return null; end if;
  select full_name into v_name from public.representatives where id = new.representative_id;
  if v_name is null then select full_name into v_name from public.profiles where id = new.profile_id; end if;
  select full_name into v_actor_name from public.profiles where id = auth.uid();
  insert into public.audit_log (institution_id, actor_id, actor_name, action, entity_type, entity_id, summary, details)
  values (new.institution_id, auth.uid(), v_actor_name, 'attendance.updated', 'meeting_participants',
          new.meeting_id, v_name, jsonb_build_object('de', old.status, 'la', new.status));
  return null;
end $$;

-- ---------- Ședințe: destinatari, publicare, desfășurare ----------
create or replace function public.can_manage_meetings() returns boolean
language sql stable as $$ select public.is_president() or public.has_perm('manage_meetings') $$;

create or replace function public.set_meeting_recipients(
  p_meeting uuid, p_all_reps boolean, p_rep_ids uuid[] default '{}', p_profile_ids uuid[] default '{}'
) returns integer language plpgsql security definer set search_path = public as $$
declare
  m public.meetings; v_rep_ids uuid[]; v_profile_only uuid[]; v_prev uuid[]; v_new uuid[]; v_count int;
begin
  select * into m from public.meetings where id = p_meeting;
  if not found or m.institution_id is distinct from public.auth_institution() then
    raise exception 'Ședință inexistentă.'; end if;
  if not public.can_manage_meetings() then raise exception 'Nu ai dreptul să administrezi ședințele.'; end if;
  if m.status not in ('draft','published','in_progress') then
    raise exception 'Destinatarii unei ședințe încheiate sau anulate nu mai pot fi modificați.'; end if;

  select coalesce(array_agg(profile_id), '{}') into v_prev
    from public.meeting_participants where meeting_id = p_meeting and profile_id is not null;

  if p_all_reps then
    select coalesce(array_agg(id), '{}') into v_rep_ids from public.representatives
     where school_year_id = m.school_year_id and status = 'active';
  else
    select coalesce(array_agg(id), '{}') into v_rep_ids from public.representatives
     where school_year_id = m.school_year_id and status = 'active' and id = any (coalesce(p_rep_ids, '{}'));
  end if;

  -- profilurile selectate care sunt deja reprezentanți activi se tratează ca reprezentanți
  select coalesce(array_agg(distinct id), '{}') into v_rep_ids from (
    select unnest(v_rep_ids) as id
    union
    select r.id from public.representatives r
     where r.school_year_id = m.school_year_id and r.status = 'active'
       and r.profile_id = any (coalesce(p_profile_ids, '{}'))
  ) s;

  select coalesce(array_agg(p.id), '{}') into v_profile_only from public.profiles p
   where p.id = any (coalesce(p_profile_ids, '{}')) and p.institution_id = m.institution_id and p.is_active
     and not exists (select 1 from public.representatives r
                      where r.profile_id = p.id and r.id = any (v_rep_ids));

  delete from public.meeting_participants
   where meeting_id = p_meeting
     and not (representative_id = any (v_rep_ids) or (representative_id is null and profile_id = any (v_profile_only)));

  -- eliminăm înregistrări „doar profil” care devin înregistrări de reprezentant
  delete from public.meeting_participants mp
   using public.representatives r
   where mp.meeting_id = p_meeting and mp.representative_id is null
     and r.id = any (v_rep_ids) and r.profile_id = mp.profile_id;

  insert into public.meeting_participants (institution_id, meeting_id, representative_id, profile_id)
  select m.institution_id, p_meeting, r.id, r.profile_id
    from public.representatives r where r.id = any (v_rep_ids)
  on conflict do nothing;

  insert into public.meeting_participants (institution_id, meeting_id, profile_id)
  select m.institution_id, p_meeting, pid from unnest(v_profile_only) pid
  on conflict do nothing;

  select count(*) into v_count from public.meeting_participants where meeting_id = p_meeting;

  if m.status in ('published','in_progress') then
    select coalesce(array_agg(profile_id), '{}') into v_new
      from public.meeting_participants
     where meeting_id = p_meeting and profile_id is not null and profile_id <> all (v_prev);
    perform public.notify_users(m.institution_id, v_new, 'meeting_published',
      'Ai fost convocat la: ' || m.title,
      format('Ședința are loc pe %s.', to_char(m.starts_at at time zone 'Europe/Bucharest', 'DD.MM.YYYY "la" HH24:MI')),
      '/sedinte/' || m.id);
  end if;

  perform public.recompute_quorum(p_meeting);
  return v_count;
end $$;

create or replace function public.publish_meeting(p_meeting uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.meetings; v_off int; v_inst public.institutions;
begin
  select * into m from public.meetings where id = p_meeting;
  if not found or m.institution_id is distinct from public.auth_institution() then
    raise exception 'Ședință inexistentă.'; end if;
  if not public.can_manage_meetings() then raise exception 'Nu ai dreptul să publici ședințe.'; end if;
  if m.status <> 'draft' then raise exception 'Doar o ciornă poate fi publicată.'; end if;
  if m.starts_at <= now() then raise exception 'Data și ora ședinței trebuie să fie în viitor.'; end if;
  if not exists (select 1 from public.meeting_participants where meeting_id = p_meeting) then
    raise exception 'Selectează cel puțin un destinatar înainte de publicare.'; end if;

  select * into v_inst from public.institutions where id = m.institution_id;
  -- remindere deja depășite la momentul publicării nu se mai trimit
  for v_off in select (jsonb_array_elements_text(coalesce(v_inst.settings -> 'reminder_offsets_minutes', '[1440,60,0]'::jsonb)))::int loop
    if now() >= m.starts_at - make_interval(mins => v_off) then
      insert into public.meeting_reminders (meeting_id, offset_minutes) values (p_meeting, v_off) on conflict do nothing;
    end if;
  end loop;

  perform set_config('app.internal', 'on', true);
  update public.meetings set status = 'published', published_at = now() where id = p_meeting;
  perform set_config('app.internal', 'off', true);
  perform public.recompute_quorum(p_meeting);
end $$;

create or replace function public.start_meeting(p_meeting uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.meetings;
begin
  select * into m from public.meetings where id = p_meeting;
  if not found or m.institution_id is distinct from public.auth_institution() then raise exception 'Ședință inexistentă.'; end if;
  if not public.can_manage_meetings() then raise exception 'Nu ai dreptul să administrezi ședințele.'; end if;
  if m.status <> 'published' then raise exception 'Doar o ședință publicată poate fi începută.'; end if;
  perform set_config('app.internal', 'on', true);
  update public.meetings set status = 'in_progress', started_at = now() where id = p_meeting;
  perform set_config('app.internal', 'off', true);
end $$;

create or replace function public.cancel_meeting(p_meeting uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare m public.meetings;
begin
  select * into m from public.meetings where id = p_meeting;
  if not found or m.institution_id is distinct from public.auth_institution() then raise exception 'Ședință inexistentă.'; end if;
  if not public.can_manage_meetings() then raise exception 'Nu ai dreptul să anulezi ședințe.'; end if;
  if m.status not in ('draft','published','in_progress') then raise exception 'Ședința nu mai poate fi anulată.'; end if;
  perform set_config('app.internal', 'on', true);
  update public.meetings set status = 'cancelled', cancelled_reason = p_reason where id = p_meeting;
  perform set_config('app.internal', 'off', true);
end $$;

-- Încheie ședința și păstrează situația finală a prezenței și a cvorumului
create or replace function public.finish_meeting(
  p_meeting uuid, p_ended_at timestamptz default null, p_decisions text default null
) returns void language plpgsql security definer set search_path = public as $$
declare m public.meetings;
begin
  select * into m from public.meetings where id = p_meeting;
  if not found or m.institution_id is distinct from public.auth_institution() then raise exception 'Ședință inexistentă.'; end if;
  if not public.can_manage_meetings() then raise exception 'Nu ai dreptul să încheii ședințe.'; end if;
  if m.status not in ('published','in_progress') then raise exception 'Doar o ședință publicată sau în desfășurare poate fi încheiată.'; end if;

  perform public.recompute_quorum(p_meeting);

  insert into public.meeting_attendance_snapshot (institution_id, meeting_id, representative_id, full_name, class_name, status)
  select m.institution_id, p_meeting, r.id, r.full_name, c.name, coalesce(mp.status, 'no_response')
    from public.representatives r
    join public.classes c on c.id = r.class_id
    left join public.meeting_participants mp on mp.meeting_id = p_meeting and mp.representative_id = r.id
   where r.school_year_id = m.school_year_id and r.status = 'active'
  on conflict (meeting_id, representative_id) do update set status = excluded.status;

  perform set_config('app.internal', 'on', true);
  update public.meetings set status = 'held',
    started_at = coalesce(started_at, starts_at),
    ended_at = coalesce(p_ended_at, now()),
    decisions = coalesce(p_decisions, decisions)
  where id = p_meeting;
  perform set_config('app.internal', 'off', true);
end $$;

create or replace function public.announce_agenda(p_meeting uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.meetings; v_users uuid[];
begin
  select * into m from public.meetings where id = p_meeting;
  if not found or m.institution_id is distinct from public.auth_institution() then raise exception 'Ședință inexistentă.'; end if;
  if not (public.can_manage_meetings() or public.has_perm('edit_agenda')) then
    raise exception 'Nu ai dreptul să publici ordinea de zi.'; end if;
  if m.status not in ('published','in_progress') then return; end if;
  select coalesce(array_agg(profile_id), '{}') into v_users
    from public.meeting_participants where meeting_id = p_meeting and profile_id is not null;
  perform public.notify_users(m.institution_id, v_users, 'agenda_published',
    'Ordine de zi actualizată: ' || m.title,
    format('Ordinea de zi are %s puncte.', (select count(*) from public.agenda_items where meeting_id = p_meeting)),
    '/sedinte/' || m.id);
end $$;

-- Prezența: confirmarea participantului
create or replace function public.set_attendance(p_meeting uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.meetings;
begin
  if p_status not in ('present','absent') then raise exception 'Stare invalidă.'; end if;
  select * into m from public.meetings where id = p_meeting;
  if not found or m.institution_id is distinct from public.auth_institution() then raise exception 'Ședință inexistentă.'; end if;
  if m.status not in ('published','in_progress') then
    raise exception 'Prezența nu mai poate fi modificată pentru această ședință.'; end if;
  update public.meeting_participants
     set status = p_status, responded_at = now(), updated_by = auth.uid()
   where meeting_id = p_meeting and profile_id = auth.uid();
  if not found then raise exception 'Nu ești convocat la această ședință.'; end if;
end $$;

-- Prezența: corecția organizatorului
create or replace function public.set_attendance_for(p_participant uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare mp public.meeting_participants; m public.meetings;
begin
  if p_status not in ('present','absent','no_response') then raise exception 'Stare invalidă.'; end if;
  select * into mp from public.meeting_participants where id = p_participant;
  if not found or mp.institution_id is distinct from public.auth_institution() then raise exception 'Participant inexistent.'; end if;
  if not (public.is_president() or public.has_perm('manage_attendance')) then
    raise exception 'Nu ai dreptul să corectezi evidența prezenței.'; end if;
  select * into m from public.meetings where id = mp.meeting_id;
  if m.status not in ('published','in_progress') then
    raise exception 'Evidența unei ședințe încheiate nu mai poate fi modificată.'; end if;
  update public.meeting_participants
     set status = case p_status when 'present' then 'present_by_organizer' else p_status end,
         responded_at = case when p_status = 'no_response' then null else now() end,
         updated_by = auth.uid()
   where id = p_participant;
end $$;

-- ---------- Notificări pe ședințe ----------
create or replace function public.meetings_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_users uuid[]; v_when text; v_body text; v_conv boolean;
begin
  select coalesce(array_agg(profile_id), '{}') into v_users
    from public.meeting_participants where meeting_id = new.id and profile_id is not null;
  v_when := to_char(new.starts_at at time zone 'Europe/Bucharest', 'DD.MM.YYYY "la" HH24:MI');

  if old.status = 'draft' and new.status = 'published' then
    select exists (select 1 from public.documents where meeting_id = new.id and category = 'convocator') into v_conv;
    v_body := format('%s%s. Motiv: %s.%s%s',
      v_when, coalesce(', ' || new.location, ''), coalesce(new.reason, 'nespecificat'),
      case when exists (select 1 from public.agenda_items where meeting_id = new.id)
           then format(' Ordine de zi: %s puncte.', (select count(*) from public.agenda_items where meeting_id = new.id)) else '' end,
      case when v_conv then ' Convocator atașat.' else '' end);
    perform public.notify_users(new.institution_id, v_users, 'meeting_published',
      'Ședință nouă: ' || new.title, v_body, '/sedinte/' || new.id);
  elsif old.status in ('published','in_progress') and new.status = 'cancelled' then
    perform public.notify_users(new.institution_id, v_users, 'meeting_cancelled',
      'Ședință anulată: ' || new.title,
      format('Ședința din %s a fost anulată.%s', v_when, coalesce(' Motiv: ' || new.cancelled_reason || '.', '')),
      '/sedinte/' || new.id);
  elsif new.status in ('published','in_progress') and old.status = new.status
        and (old.starts_at is distinct from new.starts_at or old.location is distinct from new.location
             or old.mode is distinct from new.mode or old.expected_end_at is distinct from new.expected_end_at) then
    perform public.notify_users(new.institution_id, v_users, 'meeting_updated',
      'Ședință modificată: ' || new.title,
      format('Detalii actualizate: %s%s (%s).', v_when, coalesce(', ' || new.location, ''), new.mode),
      '/sedinte/' || new.id);
  end if;
  return null;
end $$;

create or replace function public.documents_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.meetings; v_users uuid[];
begin
  if new.category = 'convocator' and new.meeting_id is not null then
    select * into m from public.meetings where id = new.meeting_id;
    if m.status in ('published','in_progress') then
      select coalesce(array_agg(profile_id), '{}') into v_users
        from public.meeting_participants where meeting_id = m.id and profile_id is not null;
      perform public.notify_users(m.institution_id, v_users, 'convocator_uploaded',
        'Convocator încărcat: ' || m.title, new.title, '/sedinte/' || m.id);
    end if;
  end if;
  return null;
end $$;

-- ---------- Remindere automate ----------
create or replace function public.send_due_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare
  m record; v_offsets int[]; v_due int[]; v_users uuid[]; v_left interval; v_label text; v_sent int := 0;
begin
  for m in
    select mt.*, i.settings as inst_settings from public.meetings mt
      join public.institutions i on i.id = mt.institution_id
     where mt.status = 'published' and mt.starts_at > now() - interval '30 minutes'
  loop
    select array_agg(x::int) into v_offsets from jsonb_array_elements_text(
      coalesce(m.inst_settings -> 'reminder_offsets_minutes', '[1440,60,0]'::jsonb)) x;
    select coalesce(array_agg(o), '{}') into v_due from unnest(v_offsets) o
     where now() >= m.starts_at - make_interval(mins => o)
       and not exists (select 1 from public.meeting_reminders r where r.meeting_id = m.id and r.offset_minutes = o);
    if array_length(v_due, 1) is null then continue; end if;

    insert into public.meeting_reminders (meeting_id, offset_minutes)
    select m.id, o from unnest(v_due) o on conflict do nothing;

    v_left := m.starts_at - now();
    v_label := case
      when v_left <= interval '0' then 'începe acum'
      when v_left < interval '90 minutes' then format('începe în %s minute', greatest(round(extract(epoch from v_left) / 60), 1))
      when v_left < interval '36 hours' then format('începe în aproximativ %s ore', round(extract(epoch from v_left) / 3600))
      else format('are loc în %s zile', round(extract(epoch from v_left) / 86400)) end;

    select coalesce(array_agg(profile_id), '{}') into v_users from public.meeting_participants
     where meeting_id = m.id and profile_id is not null and status <> 'absent';
    perform public.notify_users(m.institution_id, v_users, 'meeting_reminder',
      'Reminder: ' || m.title, format('Ședința %s (%s).', v_label,
        to_char(m.starts_at at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI')),
      '/sedinte/' || m.id);
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;

-- ---------- Voturi ----------
create or replace function public.can_manage_votes() returns boolean
language sql stable as $$ select public.is_president() or public.has_perm('manage_votes') $$;

create or replace function public.create_vote(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_inst uuid := public.auth_institution(); v_type text := p_data ->> 'vote_type';
  v_scope text := coalesce(p_data ->> 'eligible_scope', 'reprezentanti');
  v_starts timestamptz := coalesce((p_data ->> 'starts_at')::timestamptz, now());
  v_ends timestamptz := (p_data ->> 'ends_at')::timestamptz;
  v_labels text[]; v_label text; v_pos int := 0; v_ids uuid[]; v_elig int; v_status text; v_year uuid;
  v_meeting uuid := nullif(p_data ->> 'meeting_id', '')::uuid;
begin
  if v_inst is null or not public.can_manage_votes() then raise exception 'Nu ai dreptul să inițiezi voturi.'; end if;
  if coalesce(trim(p_data ->> 'title'), '') = '' or coalesce(trim(p_data ->> 'question'), '') = '' then
    raise exception 'Titlul și întrebarea sunt obligatorii.'; end if;
  if v_type not in ('da_nu','da_nu_abtinere','alegere_multipla','desemnare_persoana','consultativ') then
    raise exception 'Tip de vot invalid.'; end if;
  if v_ends is null or v_ends <= v_starts then raise exception 'Data de încheiere trebuie să fie după începere.'; end if;
  if v_ends <= now() then raise exception 'Data de încheiere trebuie să fie în viitor.'; end if;
  if v_meeting is not null and not exists (select 1 from public.meetings where id = v_meeting and institution_id = v_inst) then
    raise exception 'Ședință invalidă.'; end if;

  select array(select jsonb_array_elements_text(coalesce(p_data -> 'options', '[]'::jsonb))) into v_labels;
  v_labels := array(select trim(x) from unnest(v_labels) x where trim(x) <> '');
  if v_type = 'da_nu' then v_labels := array['Da','Nu'];
  elsif v_type = 'da_nu_abtinere' then v_labels := array['Da','Nu','Abținere'];
  end if;
  if coalesce(array_length(v_labels, 1), 0) < 2 then raise exception 'Un vot are nevoie de cel puțin două opțiuni.'; end if;

  v_year := public.current_year_id();
  v_status := case when v_starts <= now() then 'deschis' else 'programat' end;

  perform set_config('app.internal', 'on', true);
  insert into public.votes (institution_id, school_year_id, meeting_id, title, question, description, vote_type,
                            is_secret, show_interim, starts_at, ends_at, status, created_by)
  values (v_inst, v_year, v_meeting, trim(p_data ->> 'title'), trim(p_data ->> 'question'), p_data ->> 'description',
          v_type, coalesce((p_data ->> 'is_secret')::boolean, false), coalesce((p_data ->> 'show_interim')::boolean, false),
          v_starts, v_ends, v_status, auth.uid())
  returning id into v_id;
  perform set_config('app.internal', 'off', true);

  foreach v_label in array v_labels loop
    insert into public.vote_options (vote_id, label, position, is_abstention)
    values (v_id, v_label, v_pos, v_type = 'da_nu_abtinere' and v_label = 'Abținere');
    v_pos := v_pos + 1;
  end loop;

  select array(select jsonb_array_elements_text(coalesce(p_data -> 'eligible_ids', '[]'::jsonb))::uuid) into v_ids;
  insert into public.vote_eligible (vote_id, profile_id)
  select distinct v_id, p.id from public.profiles p
   where p.institution_id = v_inst and p.is_active and (
     (v_scope = 'reprezentanti' and p.role = 'reprezentant')
     or (v_scope = 'conducere' and p.role <> 'reprezentant')
     or (v_scope = 'toti')
     or (v_scope = 'selectie' and p.id = any (v_ids))
     or (v_scope = 'reprezentanti' and exists (
          select 1 from public.representatives r
           where r.profile_id = p.id and r.status = 'active' and r.school_year_id = v_year)))
  on conflict do nothing;

  select count(*) into v_elig from public.vote_eligible where vote_id = v_id;
  if v_elig = 0 then raise exception 'Niciun utilizator eligibil. Verifică selecția sau conturile reprezentanților.'; end if;

  perform public.notify_users(v_inst, array(select profile_id from public.vote_eligible where vote_id = v_id),
    'vote_started',
    case when v_status = 'deschis' then 'Vot deschis: ' else 'Vot programat: ' end || trim(p_data ->> 'title'),
    format('%s Votul se încheie pe %s.', trim(p_data ->> 'question'),
           to_char(v_ends at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI')),
    '/voturi/' || v_id);
  return v_id;
end $$;

create or replace function public.close_vote_internal(p_vote uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.votes; v_elig int; v_voted int; v_opts jsonb; v_outcome text; v_max int; v_winners int; v_nonabst int;
  v_da int; v_nu int;
begin
  select * into v from public.votes where id = p_vote for update;
  if not found or v.status = 'inchis' then return; end if;

  select count(*) into v_elig from public.vote_eligible where vote_id = p_vote;
  select count(*) into v_voted from public.vote_participation where vote_id = p_vote;
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'is_abstention', o.is_abstention,
           'count', (select count(*) from public.ballots b where b.option_id = o.id)) order by o.position), '[]'::jsonb)
    into v_opts from public.vote_options o where o.vote_id = p_vote;

  select coalesce(max((x ->> 'count')::int), 0) into v_max from jsonb_array_elements(v_opts) x where not (x ->> 'is_abstention')::boolean;
  select count(*) into v_winners from jsonb_array_elements(v_opts) x
   where not (x ->> 'is_abstention')::boolean and (x ->> 'count')::int = v_max;
  select coalesce(sum((x ->> 'count')::int), 0) into v_nonabst from jsonb_array_elements(v_opts) x where not (x ->> 'is_abstention')::boolean;

  if v.vote_type in ('da_nu','da_nu_abtinere') then
    select (x ->> 'count')::int into v_da from jsonb_array_elements(v_opts) x where x ->> 'label' = 'Da';
    select (x ->> 'count')::int into v_nu from jsonb_array_elements(v_opts) x where x ->> 'label' = 'Nu';
    v_outcome := case when v_da > v_nu then 'Adoptat' when v_nu > v_da then 'Respins' else 'Egalitate' end;
  elsif v_nonabst = 0 then v_outcome := 'Fără voturi exprimate';
  elsif v_winners > 1 then v_outcome := 'Egalitate';
  else select x ->> 'label' into v_outcome from jsonb_array_elements(v_opts) x
        where not (x ->> 'is_abstention')::boolean and (x ->> 'count')::int = v_max limit 1;
  end if;

  perform set_config('app.internal', 'on', true);
  update public.votes set status = 'inchis', closed_at = now(), result = jsonb_build_object(
      'eligible', v_elig, 'voted', v_voted, 'not_voted', v_elig - v_voted,
      'participation_pct', case when v_elig > 0 then round(100.0 * v_voted / v_elig, 1) else 0 end,
      'options', v_opts, 'outcome', v_outcome, 'binding', v.vote_type <> 'consultativ')
   where id = p_vote;
  perform set_config('app.internal', 'off', true);

  perform public.notify_users(v.institution_id,
    array(select profile_id from public.vote_eligible where vote_id = p_vote)
      || array(select id from public.profiles where institution_id = v.institution_id and is_active and role <> 'reprezentant'),
    'vote_closed', 'Vot încheiat: ' || v.title,
    format('Rezultat: %s. Participare: %s din %s.', v_outcome, v_voted, v_elig), '/voturi/' || p_vote);
end $$;

create or replace function public.close_vote(p_vote uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.votes;
begin
  select * into v from public.votes where id = p_vote;
  if not found or v.institution_id is distinct from public.auth_institution() then raise exception 'Vot inexistent.'; end if;
  if not public.can_manage_votes() then raise exception 'Nu ai dreptul să închizi votul.'; end if;
  if v.status = 'inchis' then raise exception 'Votul este deja încheiat.'; end if;
  perform public.close_vote_internal(p_vote);
end $$;

create or replace function public.sync_votes() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  perform set_config('app.internal', 'on', true);
  for r in select id, institution_id, title from public.votes where status = 'programat' and starts_at <= now() loop
    update public.votes set status = 'deschis' where id = r.id;
    perform public.notify_users(r.institution_id, array(select profile_id from public.vote_eligible where vote_id = r.id),
      'vote_started', 'Votul a început: ' || r.title, 'Poți vota acum.', '/voturi/' || r.id);
    v_n := v_n + 1;
  end loop;
  perform set_config('app.internal', 'off', true);
  for r in select id from public.votes where status in ('programat','deschis') and ends_at <= now() loop
    perform public.close_vote_internal(r.id); v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.cast_vote(p_vote uuid, p_option uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.votes;
begin
  perform public.sync_votes();
  select * into v from public.votes where id = p_vote;
  if not found or v.institution_id is distinct from public.auth_institution() then raise exception 'Vot inexistent.'; end if;
  if v.status <> 'deschis' then raise exception 'Votul nu este deschis.'; end if;
  if not exists (select 1 from public.vote_eligible where vote_id = p_vote and profile_id = auth.uid()) then
    raise exception 'Nu ai drept de vot la această procedură.'; end if;
  if not exists (select 1 from public.vote_options where id = p_option and vote_id = p_vote) then
    raise exception 'Opțiune invalidă.'; end if;

  insert into public.vote_participation (vote_id, profile_id) values (p_vote, auth.uid()) on conflict do nothing;
  if not found then raise exception 'Ai votat deja.'; end if;

  if v.is_secret then
    insert into public.ballots (vote_id, option_id) values (p_vote, p_option);
  else
    insert into public.ballots (vote_id, option_id, profile_id, cast_at) values (p_vote, p_option, auth.uid(), now());
  end if;
end $$;

create or replace function public.vote_tally(p_vote uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.votes; v_elig int; v_voted int; v_show boolean; v_opts jsonb;
begin
  select * into v from public.votes where id = p_vote;
  if not found or v.institution_id is distinct from public.auth_institution() then raise exception 'Vot inexistent.'; end if;
  if not (public.is_leadership() or exists (select 1 from public.vote_eligible where vote_id = p_vote and profile_id = auth.uid())) then
    raise exception 'Nu ai acces la acest vot.'; end if;
  select count(*) into v_elig from public.vote_eligible where vote_id = p_vote;
  select count(*) into v_voted from public.vote_participation where vote_id = p_vote;
  v_show := v.status = 'inchis' or (v.status = 'deschis' and v.show_interim);
  if v_show then
    select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'is_abstention', o.is_abstention,
             'count', (select count(*) from public.ballots b where b.option_id = o.id)) order by o.position)
      into v_opts from public.vote_options o where o.vote_id = p_vote;
  end if;
  return jsonb_build_object('status', v.status, 'is_secret', v.is_secret, 'eligible', v_elig, 'voted', v_voted,
    'not_voted', v_elig - v_voted,
    'participation_pct', case when v_elig > 0 then round(100.0 * v_voted / v_elig, 1) else 0 end,
    'results_visible', v_show, 'options', coalesce(v_opts, '[]'::jsonb), 'outcome', v.result ->> 'outcome');
end $$;

-- Cine a votat ce, doar la voturi publice și doar când rezultatele sunt vizibile
create or replace function public.vote_public_choices(p_vote uuid)
returns table (voter text, choice text, cast_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v public.votes;
begin
  select * into v from public.votes where id = p_vote;
  if not found or v.institution_id is distinct from public.auth_institution() then raise exception 'Vot inexistent.'; end if;
  if v.is_secret then raise exception 'Votul este secret.'; end if;
  if not public.is_leadership() then raise exception 'Doar conducerea poate vedea voturile publice.'; end if;
  if not (v.status = 'inchis' or (v.status = 'deschis' and v.show_interim)) then
    raise exception 'Rezultatele nu sunt încă vizibile.'; end if;
  return query
    select p.full_name, o.label, b.cast_at from public.ballots b
      join public.profiles p on p.id = b.profile_id
      join public.vote_options o on o.id = b.option_id
     where b.vote_id = p_vote order by p.full_name;
end $$;

-- ---------- Anunțuri ----------
create or replace function public.publish_announcement(
  p_title text, p_content text, p_audience text, p_pinned boolean default false, p_recipients uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_inst uuid := public.auth_institution(); v_id uuid; v_users uuid[];
begin
  if v_inst is null or not (public.is_president() or public.has_perm('manage_announcements')) then
    raise exception 'Nu ai dreptul să publici anunțuri.'; end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_content), '') = '' then
    raise exception 'Titlul și conținutul sunt obligatorii.'; end if;
  if p_audience not in ('toti','conducere','selectie') then raise exception 'Public invalid.'; end if;

  insert into public.announcements (institution_id, title, content, author_id, audience, pinned)
  values (v_inst, trim(p_title), trim(p_content), auth.uid(), p_audience, coalesce(p_pinned, false))
  returning id into v_id;

  if p_audience = 'selectie' then
    insert into public.announcement_recipients (announcement_id, profile_id)
    select v_id, id from public.profiles where id = any (coalesce(p_recipients, '{}')) and institution_id = v_inst
    on conflict do nothing;
    select array(select profile_id from public.announcement_recipients where announcement_id = v_id) into v_users;
  elsif p_audience = 'conducere' then
    select array(select id from public.profiles where institution_id = v_inst and is_active and role <> 'reprezentant') into v_users;
  else
    select array(select id from public.profiles where institution_id = v_inst and is_active) into v_users;
  end if;

  perform public.notify_users(v_inst, v_users, 'announcement', 'Anunț: ' || trim(p_title),
    left(trim(p_content), 160), '/anunturi');
  return v_id;
end $$;

-- ---------- Sesizări, sarcini, proiecte, măsuri: notificări ----------
create or replace function public.feedback_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_users(new.institution_id, array(select public.perm_holders(new.institution_id, 'view_feedback')),
    'feedback_new', 'Mesaj nou: ' || new.title,
    format('Importanță: %s. Tip: %s.', new.importance, new.kind), '/vocea-reprezentantilor/' || new.id);
  return null;
end $$;

create or replace function public.feedback_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform public.notify_users(new.institution_id, array[new.author_id],
      case new.status when 'solutionat' then 'feedback_resolved' else 'feedback_status' end,
      case new.status
        when 'in_analiza' then 'Propunerea ta este în analiză'
        when 'acceptat' then 'Propunerea ta a fost acceptată'
        when 'in_solutionare' then 'Propunerea ta este în curs de soluționare'
        when 'solutionat' then 'Propunerea ta a fost soluționată'
        when 'respins' then 'Propunerea ta a fost respinsă'
        else 'Stare actualizată' end,
      new.title || coalesce(' — ' || left(new.official_response, 120), ''),
      '/vocea-reprezentantilor/' || new.id);
  elsif new.official_response is distinct from old.official_response and new.official_response is not null then
    perform public.notify_users(new.institution_id, array[new.author_id], 'feedback_status',
      'Ai primit un răspuns oficial', new.title, '/vocea-reprezentantilor/' || new.id);
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    perform public.notify_users(new.institution_id, array[new.assigned_to], 'task_assigned',
      'Ți-a fost atribuită o sesizare', new.title, '/vocea-reprezentantilor/' || new.id);
  end if;
  return null;
end $$;

create or replace function public.tasks_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and (TG_OP = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.notify_users(new.institution_id, array[new.assignee_id], 'task_assigned',
      'Ți-a fost atribuită o sarcină', new.title,
      case when new.project_id is not null then '/proiecte/' || new.project_id else '/proiecte' end);
  end if;
  return null;
end $$;

create or replace function public.projects_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    perform public.notify_users(new.institution_id,
      array(select id from public.profiles where institution_id = new.institution_id and is_active),
      'project_added', 'Proiect nou: ' || new.title, left(coalesce(new.description, ''), 140), '/proiecte/' || new.id);
  elsif new.title is distinct from old.title or new.status is distinct from old.status
        or new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on then
    perform public.notify_users(new.institution_id,
      array(select profile_id from public.project_members where project_id = new.id),
      'project_updated', 'Proiect modificat: ' || new.title, 'Stare: ' || new.status, '/proiecte/' || new.id);
  end if;
  return null;
end $$;

create or replace function public.measures_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  select profile_id into v_profile from public.representatives where id = new.representative_id;
  perform public.notify_users(new.institution_id, array[v_profile], 'measure_applied',
    case new.kind when 'mustrare' then 'Ți-a fost înregistrată o mustrare'
                  when 'avertisment' then 'Ți-a fost înregistrat un avertisment'
                  else 'A fost inițiată o procedură privind mandatul tău' end,
    new.reason, '/profilul-meu');
  return null;
end $$;

-- ---------- Atașarea triggerelor ----------
create trigger profiles_guard_trg before update on public.profiles for each row execute function public.profiles_guard();
create trigger meetings_guard_trg before insert or update on public.meetings for each row execute function public.meetings_guard();
create trigger votes_guard_trg before insert or update on public.votes for each row execute function public.votes_guard();
create trigger measures_guard_trg before update or delete on public.admin_measures for each row execute function public.measures_guard();
create trigger audit_immutable_trg before update or delete on public.audit_log for each row execute function public.prevent_modification();
create trigger feedback_before_update_trg before update on public.feedback_items for each row execute function public.feedback_before_update();
create trigger tasks_before_update_trg before update on public.tasks for each row execute function public.tasks_before_update();

create trigger touch_representatives before update on public.representatives for each row execute function public.touch_updated_at();
create trigger touch_projects before update on public.projects for each row execute function public.touch_updated_at();
create trigger touch_activities before update on public.activities for each row execute function public.touch_updated_at();

create trigger participants_quorum_trg after insert or update or delete on public.meeting_participants
  for each row execute function public.participants_after_change();
create trigger participants_audit_trg after update on public.meeting_participants
  for each row execute function public.audit_attendance();
create trigger representatives_quorum_trg after insert or update of status or delete on public.representatives
  for each row execute function public.representatives_after_change();

create trigger meetings_notify_trg after update on public.meetings for each row execute function public.meetings_after_update();
create trigger documents_notify_trg after insert on public.documents for each row execute function public.documents_after_insert();
create trigger feedback_insert_trg after insert on public.feedback_items for each row execute function public.feedback_after_insert();
create trigger feedback_update_trg after update on public.feedback_items for each row execute function public.feedback_after_update();
create trigger tasks_notify_trg after insert or update on public.tasks for each row execute function public.tasks_after_change();
create trigger projects_notify_trg after insert or update on public.projects for each row execute function public.projects_after_change();
create trigger measures_notify_trg after insert on public.admin_measures for each row execute function public.measures_after_insert();

do $$
declare t text;
begin
  foreach t in array array['institutions','school_years','profiles','classes','representatives','meetings','votes',
      'feedback_items','projects','activities','announcements','admin_measures','documents','calendar_events'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                   'audit_' || t || '_trg', t);
  end loop;
end $$;

-- ---------- Joburi periodice (apelabile din cron sau la încărcarea paginilor) ----------
create or replace function public.run_scheduled_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object('votes', public.sync_votes(), 'reminders', public.send_due_reminders());
end $$;

-- ---------- Anul școlar nou ----------
create or replace function public.start_new_school_year(
  p_label text, p_starts date, p_ends date, p_carry_reps boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_inst uuid := public.auth_institution(); v_old uuid; v_new uuid; c record; v_cls uuid;
begin
  if v_inst is null or not public.is_president() then raise exception 'Doar președintele poate începe un an școlar nou.'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'Denumirea anului școlar este obligatorie.'; end if;
  select id into v_old from public.school_years where institution_id = v_inst and is_current;
  update public.school_years set is_current = false, archived_at = now() where id = v_old;
  insert into public.school_years (institution_id, label, starts_on, ends_on, is_current)
  values (v_inst, trim(p_label), p_starts, p_ends, true) returning id into v_new;

  for c in select * from public.classes where school_year_id = v_old loop
    insert into public.classes (institution_id, school_year_id, name) values (v_inst, v_new, c.name) returning id into v_cls;
    if p_carry_reps then
      insert into public.representatives (institution_id, school_year_id, profile_id, full_name, class_id, position, email, status, mandate_start)
      select v_inst, v_new, r.profile_id, r.full_name, v_cls, r.position, r.email, 'active', coalesce(p_starts, current_date)
        from public.representatives r where r.class_id = c.id and r.status = 'active';
    end if;
  end loop;
  return v_new;
end $$;

-- ---------- Date demonstrative (marcate is_demo, ștergibile) ----------
create or replace function public.seed_demo_data() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_inst uuid := public.auth_institution(); v_year uuid := public.current_year_id(); v_me uuid := auth.uid();
  v_cls uuid[] := '{}'; v_id uuid; i int; v_names text[] := array['Andrei Popescu','Maria Ionescu','Alex Dumitru','Elena Stan','Vlad Georgescu','Ioana Radu','Matei Constantin','Sofia Marin','Darius Toma'];
  v_classes text[] := array['IX A','IX B','X A','X B','XI A','XI B','XII A','XII B','IX C'];
  v_reps uuid[] := '{}'; v_m1 uuid; v_m2 uuid; v_p uuid;
begin
  if v_inst is null or not public.is_president() then raise exception 'Doar președintele poate încărca date demonstrative.'; end if;
  if exists (select 1 from public.meetings where institution_id = v_inst and is_demo) then
    raise exception 'Datele demonstrative sunt deja încărcate.'; end if;

  for i in 1..9 loop
    insert into public.classes (institution_id, school_year_id, name, is_demo)
    values (v_inst, v_year, v_classes[i] || ' (demo)', true) returning id into v_id;
    insert into public.representatives (institution_id, school_year_id, full_name, class_id, is_demo)
    values (v_inst, v_year, v_names[i], v_id, true) returning id into v_id;
    v_reps := v_reps || v_id;
  end loop;

  -- ședință desfășurată
  insert into public.meetings (institution_id, school_year_id, title, starts_at, location, reason, status, is_demo, created_by)
  values (v_inst, v_year, 'Ședință demonstrativă – început de semestru', now() - interval '20 days', 'Sala festivă',
          'Planificarea activităților', 'draft', true, v_me) returning id into v_m1;
  insert into public.meeting_participants (institution_id, meeting_id, representative_id)
  select v_inst, v_m1, unnest(v_reps);
  update public.meeting_participants set status = 'present' where meeting_id = v_m1 and representative_id = any (v_reps[1:6]);
  update public.meeting_participants set status = 'absent' where meeting_id = v_m1 and representative_id = any (v_reps[7:7]);
  perform set_config('app.internal', 'on', true);
  update public.meetings set status = 'published', published_at = now() - interval '25 days' where id = v_m1;
  perform set_config('app.internal', 'off', true);
  perform public.finish_meeting(v_m1, now() - interval '20 days' + interval '1 hour', 'Decizii demonstrative.');

  -- ședință viitoare
  insert into public.meetings (institution_id, school_year_id, title, starts_at, location, reason, is_demo, created_by)
  values (v_inst, v_year, 'Ședință demonstrativă – bilanț', now() + interval '7 days', 'Sala festivă',
          'Bilanțul activităților', true, v_me) returning id into v_m2;
  insert into public.agenda_items (meeting_id, position, title) values
    (v_m2, 0, 'Raportul președintelui'), (v_m2, 1, 'Propuneri ale reprezentanților');
  insert into public.meeting_participants (institution_id, meeting_id, representative_id)
  select v_inst, v_m2, unnest(v_reps);
  perform public.publish_meeting(v_m2);

  -- proiect cu sarcini
  insert into public.projects (institution_id, school_year_id, title, description, category, status, starts_on, ends_on, created_by, is_demo)
  values (v_inst, v_year, 'Proiect demonstrativ – Campanie de reciclare', 'Exemplu de proiect.', 'campanie', 'in_desfasurare',
          current_date - 10, current_date + 30, v_me, true) returning id into v_p;
  insert into public.tasks (institution_id, project_id, title, kind, status, due_date, created_by) values
    (v_inst, v_p, 'Stabilirea echipei', 'etapa', 'finalizat', current_date - 5, v_me),
    (v_inst, v_p, 'Amplasarea containerelor', 'sarcina', 'in_lucru', current_date + 7, v_me),
    (v_inst, v_p, 'Raport final', 'etapa', 'de_facut', current_date + 28, v_me);

  insert into public.feedback_items (institution_id, school_year_id, author_id, representative_id, kind, title, description, class_id, importance, is_demo)
  select v_inst, v_year, v_me, v_reps[1], 'propunere', 'Propunere demonstrativă – panou de anunțuri',
         'Exemplu de propunere transmisă de un reprezentant.', id, 'mediu', true from public.classes where school_year_id = v_year and is_demo limit 1;

  insert into public.announcements (institution_id, title, content, author_id, audience, is_demo)
  values (v_inst, 'Anunț demonstrativ', 'Acesta este un anunț de test; poate fi șters.', v_me, 'toti', true);
end $$;

create or replace function public.clear_demo_data() returns void
language plpgsql security definer set search_path = public as $$
declare v_inst uuid := public.auth_institution();
begin
  if v_inst is null or not public.is_president() then raise exception 'Doar președintele poate șterge datele demonstrative.'; end if;
  delete from public.votes where institution_id = v_inst and is_demo;
  delete from public.meetings where institution_id = v_inst and is_demo;
  delete from public.projects where institution_id = v_inst and is_demo;
  delete from public.activities where institution_id = v_inst and is_demo;
  delete from public.feedback_items where institution_id = v_inst and is_demo;
  delete from public.announcements where institution_id = v_inst and is_demo;
  delete from public.representatives where institution_id = v_inst and is_demo;
  delete from public.classes where institution_id = v_inst and is_demo;
end $$;

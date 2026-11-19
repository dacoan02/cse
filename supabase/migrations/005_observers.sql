-- =====================================================================
-- 005: Profiluri „Director” și „Consilier educativ” (observatori, doar citire)
-- Văd: ședințe, prezențe, cvorum, documente, proiecte/activități/calendar și rezultatele voturilor.
-- Nu pot: scrie nimic, nu văd sesizări, măsuri administrative, jurnal, rapoarte, setări.
-- =====================================================================
set check_function_bodies = off;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('presedinte','secretar','vicepresedinte','reprezentant','director','consilier'));

create or replace function public.is_observer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('director','consilier') from public.profiles where id = auth.uid() and is_active), false)
$$;
create or replace function public.can_observe() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_leadership() or public.is_observer()
$$;
grant execute on function public.is_observer(), public.can_observe() to authenticated;

-- Observatorii nu au niciodată drepturi de scriere, indiferent de suprascrieri
create or replace function public.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when role = 'presedinte' then true
      when role in ('reprezentant','director','consilier') then false
      when jsonb_exists(permissions, p_perm) then (permissions ->> p_perm)::boolean
      else public.perm_default(role, p_perm)
    end
    from public.profiles where id = auth.uid() and is_active
  ), false)
$$;


create or replace function public.perm_holders(p_inst uuid, p_perm text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles
  where institution_id = p_inst and is_active and role in ('presedinte','secretar','vicepresedinte')
    and (role = 'presedinte'
         or coalesce(case when jsonb_exists(permissions, p_perm) then (permissions ->> p_perm)::boolean end,
                     public.perm_default(role, p_perm)))
$$;

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
     or (v_scope = 'conducere' and p.role in ('presedinte','secretar','vicepresedinte'))
     or (v_scope = 'toti' and p.role in ('presedinte','secretar','vicepresedinte','reprezentant'))
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
      || array(select id from public.profiles where institution_id = v.institution_id and is_active and role in ('presedinte','secretar','vicepresedinte')),
    'vote_closed', 'Vot încheiat: ' || v.title,
    format('Rezultat: %s. Participare: %s din %s.', v_outcome, v_voted, v_elig), '/voturi/' || p_vote);
end $$;

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
    select array(select id from public.profiles where institution_id = v_inst and is_active and role in ('presedinte','secretar','vicepresedinte')) into v_users;
  else
    select array(select id from public.profiles where institution_id = v_inst and is_active and role not in ('director','consilier')) into v_users;
  end if;

  perform public.notify_users(v_inst, v_users, 'announcement', 'Anunț: ' || trim(p_title),
    left(trim(p_content), 160), '/anunturi');
  return v_id;
end $$;

create or replace function public.vote_tally(p_vote uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.votes; v_elig int; v_voted int; v_show boolean; v_opts jsonb;
begin
  select * into v from public.votes where id = p_vote;
  if not found or v.institution_id is distinct from public.auth_institution() then raise exception 'Vot inexistent.'; end if;
  if not (public.can_observe() or exists (select 1 from public.vote_eligible where vote_id = p_vote and profile_id = auth.uid())) then
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


-- ---------- Documente ----------
create or replace function public.can_read_doc(d public.documents) returns boolean
language sql stable security definer set search_path = public as $$
  select d.institution_id = public.auth_institution() and (
    public.is_president()
    or d.uploaded_by = auth.uid()
    or (d.announcement_id is not null and exists (
          select 1 from public.announcements a
           where a.id = d.announcement_id and (
                 a.audience = 'toti'
              or (a.audience = 'conducere' and public.is_leadership())
              or (a.audience = 'selectie' and (public.is_leadership() or exists (
                    select 1 from public.announcement_recipients r where r.announcement_id = a.id and r.profile_id = auth.uid()))))))
    or (d.announcement_id is null and d.measure_id is null and d.visibility = 'toti' and (
          d.meeting_id is null
          or public.is_leadership()
          or exists (select 1 from public.meeting_participants mp join public.meetings m on m.id = mp.meeting_id
                      where mp.meeting_id = d.meeting_id and mp.profile_id = auth.uid() and m.status <> 'draft')))
    or (d.announcement_id is null and d.measure_id is null and d.visibility = 'conducere' and public.is_leadership())
    or (d.measure_id is null and d.visibility = 'restrans' and public.has_perm('view_feedback'))
    or (public.is_observer() and d.announcement_id is null and d.measure_id is null and d.feedback_id is null
        and d.visibility in ('toti','conducere')
        and (d.meeting_id is null or exists (select 1 from public.meetings m where m.id = d.meeting_id and m.status <> 'draft')))
  )
$$;

-- ---------- Politici de citire pentru observatori ----------
-- (funcție separată, ca să nu apară recursie între politicile meetings și meeting_participants)
create or replace function public.meeting_is_visible_to_observer(p_meeting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.meetings m where m.id = p_meeting and m.status <> 'draft'
                   and m.institution_id = public.auth_institution())
$$;
grant execute on function public.meeting_is_visible_to_observer(uuid) to authenticated;

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings for select to authenticated
  using (institution_id = public.auth_institution() and (
    public.is_leadership()
    or (public.is_observer() and status <> 'draft')
    or (status <> 'draft' and exists (select 1 from public.meeting_participants mp
                                       where mp.meeting_id = meetings.id and mp.profile_id = auth.uid()))));

drop policy if exists participants_select on public.meeting_participants;
create policy participants_select on public.meeting_participants for select to authenticated
  using (institution_id = public.auth_institution() and (public.is_leadership() or profile_id = auth.uid()
    or (public.is_observer() and public.meeting_is_visible_to_observer(meeting_id))));

drop policy if exists snapshot_select on public.meeting_attendance_snapshot;
create policy snapshot_select on public.meeting_attendance_snapshot for select to authenticated
  using (institution_id = public.auth_institution() and (
    public.is_leadership() or public.is_observer()
    or exists (select 1 from public.representatives r
                where r.id = meeting_attendance_snapshot.representative_id and r.profile_id = auth.uid())));

drop policy if exists votes_select on public.votes;
create policy votes_select on public.votes for select to authenticated
  using (institution_id = public.auth_institution() and (
    public.has_perm('manage_votes')
    or (status <> 'draft' and (public.is_leadership() or public.is_observer()
        or exists (select 1 from public.vote_eligible e where e.vote_id = votes.id and e.profile_id = auth.uid())))));


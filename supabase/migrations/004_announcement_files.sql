-- =====================================================================
-- 004: Fișiere atașate anunțurilor
-- Citirea unui fișier de anunț urmează publicul anunțului (toți / conducere / selecție).
-- Documentele justificative ale măsurilor administrative sunt vizibile doar președintelui și celui care le-a încărcat.
-- =====================================================================
alter table public.documents add column if not exists announcement_id uuid references public.announcements(id) on delete cascade;
create index if not exists documents_announcement_idx on public.documents (announcement_id);

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
  )
$$;

drop policy documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (institution_id = public.auth_institution() and uploaded_by = auth.uid() and (
    public.has_perm('manage_documents')
    or (announcement_id is not null and public.has_perm('manage_announcements'))
    or (feedback_id is not null and visibility = 'restrans'
        and exists (select 1 from public.feedback_items f where f.id = feedback_id and f.author_id = auth.uid()))));

drop policy documents_bucket_insert on storage.objects;
create policy documents_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_institution()::text
    and (public.has_perm('manage_documents')
         or (storage.foldername(name))[2] = 'feedback'
         or ((storage.foldername(name))[2] = 'anunturi' and public.has_perm('manage_announcements'))));

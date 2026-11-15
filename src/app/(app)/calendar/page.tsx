import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CalendarView, type CalEvent } from "@/components/calendar-view";
import { AddCalendarEventButton } from "@/components/calendar-add";
import { PageHeader } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export const metadata = { title: "Calendar" };

export default async function Page() {
  const s = await requireSession();
  const supabase = await createClient();
  const y = s.year?.id ?? "";
  const [m, a, p, t, v, c] = await Promise.all([
    supabase.from("meetings").select("id,title,meeting_type,starts_at,expected_end_at,location,reason,status").eq("school_year_id", y).neq("status", "cancelled"),
    supabase.from("activities").select("id,title,description,starts_at,ends_at,location,status").eq("school_year_id", y).neq("status", "anulata"),
    supabase.from("projects").select("id,title,description,starts_on,ends_on,status").eq("school_year_id", y).neq("status", "anulat"),
    supabase.from("tasks").select("id,title,description,due_date,project_id,status,projects(title)").not("due_date", "is", null).not("project_id", "is", null).neq("status", "finalizat"),
    supabase.from("votes").select("id,title,question,starts_at,ends_at,status").eq("school_year_id", y).neq("status", "draft"),
    supabase.from("calendar_events").select("*"),
  ]);
  const events: CalEvent[] = [];
  for (const x of (m.data ?? []) as any[]) events.push({ id: `m${x.id}`, title: x.title, start: x.starts_at, end: x.expected_end_at, kind: x.meeting_type, href: `/sedinte/${x.id}`, description: x.reason, location: x.location });
  for (const x of (a.data ?? []) as any[]) events.push({ id: `a${x.id}`, title: x.title, start: x.starts_at, end: x.ends_at, kind: "activitate", href: "/proiecte?tab=activitati", description: x.description, location: x.location });
  for (const x of (p.data ?? []) as any[]) {
    if (x.starts_on) events.push({ id: `ps${x.id}`, title: `Început: ${x.title}`, start: `${x.starts_on}T09:00:00`, kind: "proiect", href: `/proiecte/${x.id}`, description: x.description });
    if (x.ends_on) events.push({ id: `pe${x.id}`, title: `Finalizare: ${x.title}`, start: `${x.ends_on}T17:00:00`, kind: "proiect", href: `/proiecte/${x.id}`, description: x.description });
  }
  for (const x of (t.data ?? []) as any[]) events.push({ id: `t${x.id}`, title: `Termen: ${x.title}`, start: `${x.due_date}T12:00:00`, kind: "termen", href: `/proiecte/${x.project_id}`, description: x.projects?.title ? `Proiect: ${x.projects.title}` : x.description });
  for (const x of (v.data ?? []) as any[]) {
    events.push({ id: `vs${x.id}`, title: `Vot începe: ${x.title}`, start: x.starts_at, kind: "vot", href: `/voturi/${x.id}`, description: x.question });
    events.push({ id: `ve${x.id}`, title: `Vot se încheie: ${x.title}`, start: x.ends_at, kind: "vot", href: `/voturi/${x.id}`, description: x.question });
  }
  for (const x of (c.data ?? []) as any[]) events.push({ id: `c${x.id}`, title: x.title, start: x.starts_at, end: x.ends_at, kind: x.kind === "termen_limita" ? "termen" : x.kind === "eveniment" ? "eveniment" : "altele", description: x.description, deletable: s.can("manage_calendar") });
  return (
    <>
      <RealtimeRefresh tables={["meetings", "projects", "tasks", "votes"]} />
      <PageHeader title="Calendar" description="Ședințe, termene-limită, proiecte, activități, voturi și evenimente. Se actualizează automat când ceva se modifică." actions={s.can("manage_calendar") && <AddCalendarEventButton />} />
      <CalendarView events={events} />
    </>
  );
}

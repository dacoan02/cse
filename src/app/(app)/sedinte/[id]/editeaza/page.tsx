import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMeetingFormData } from "@/lib/meeting-form-data";
import { MeetingForm } from "@/components/meeting-form";
import { Card, PageHeader } from "@/components/ui";
import { isoToLocalInput } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export const metadata = { title: "Modifică ședința" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePerm("manage_meetings");
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Meeting;
  if (m.status === "held" || m.status === "cancelled") redirect(`/sedinte/${id}`);
  const [{ reps, leaders }, { data: agenda }, { data: parts }] = await Promise.all([
    getMeetingFormData(supabase, s.year?.id),
    supabase.from("agenda_items").select("title").eq("meeting_id", id).order("position"),
    supabase.from("meeting_participants").select("representative_id,profile_id").eq("meeting_id", id),
  ]);
  const selReps = (parts ?? []).map((p: any) => p.representative_id).filter(Boolean) as string[];
  const selProfiles = (parts ?? []).filter((p: any) => !p.representative_id).map((p: any) => p.profile_id) as string[];
  // conducerea convocată fiind și reprezentant nu apare aici; conducerea pură e în profile_ids
  return (
    <>
      <PageHeader title="Modifică ședința" description={m.title} />
      <Card className="p-5 sm:p-6">
        <MeetingForm reps={reps} leaders={leaders} selectedReps={selReps} selectedProfiles={selProfiles}
          values={{ id: m.id, status: m.status, title: m.title, meeting_type: m.meeting_type, starts_at: isoToLocalInput(m.starts_at), expected_end_at: isoToLocalInput(m.expected_end_at),
            location: m.location ?? "", mode: m.mode, online_link: m.online_link ?? "", reason: m.reason ?? "", description: m.description ?? "", agenda: (agenda ?? []).map((a: any) => a.title).join("\n") }} />
      </Card>
    </>
  );
}

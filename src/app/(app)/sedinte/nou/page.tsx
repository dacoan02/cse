import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMeetingFormData } from "@/lib/meeting-form-data";
import { MeetingForm } from "@/components/meeting-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Programează o ședință" };

export default async function Page() {
  const s = await requirePerm("manage_meetings");
  const supabase = await createClient();
  const { reps, leaders } = await getMeetingFormData(supabase, s.year?.id);
  return (
    <>
      <PageHeader title="Programează o ședință" description="Completează formularul, apoi salvează ca ciornă sau publică și notifică participanții." />
      <Card className="p-5 sm:p-6">
        <MeetingForm reps={reps} leaders={leaders} selectedReps={reps.map((r) => r.id)} selectedProfiles={leaders.map((l) => l.id)} />
      </Card>
    </>
  );
}

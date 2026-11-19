import { requireNotObserver } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClasses } from "@/lib/data";
import { FeedbackForm } from "@/components/feedback-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Transmite o problemă sau o propunere" };

export default async function Page() {
  const s = await requireNotObserver();
  const supabase = await createClient();
  const classes = await getClasses(supabase, s.year?.id);
  const { data: rep } = await supabase.from("representatives").select("class_id").eq("profile_id", s.userId).eq("school_year_id", s.year?.id ?? "").maybeSingle();
  return (
    <>
      <PageHeader title="Transmite o problemă sau o propunere" description="Mesajul ajunge la președinte și la persoanele autorizate. Vei putea urmări stadiul lui." />
      <Card className="p-5 sm:p-6"><FeedbackForm classes={classes} defaultClass={rep?.class_id ?? ""} /></Card>
    </>
  );
}

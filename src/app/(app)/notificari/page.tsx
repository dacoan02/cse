import Link from "next/link";
import { Bell } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { ActionButton } from "@/components/confirm-action";
import { NotificationItem } from "@/components/notification-item";
import { markAllRead } from "@/app/actions/notifications";
import type { NotificationRow } from "@/lib/types";

export const metadata = { title: "Notificări" };

export default async function Page({ searchParams }: { searchParams: Promise<{ vezi?: string }> }) {
  const { vezi } = await searchParams;
  const archived = vezi === "arhivate";
  const s = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", s.userId).eq("is_archived", archived).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as NotificationRow[];
  return (
    <>
      <PageHeader title="Notificări" description="Generate automat din evenimente reale: ședințe, voturi, anunțuri, sesizări, sarcini."
        actions={<>
          <Link href={archived ? "/notificari" : "/notificari?vezi=arhivate"} className={buttonClass("secondary")}>{archived ? "Vezi active" : "Vezi arhiva"}</Link>
          {!archived && rows.some((r) => !r.is_read) && <ActionButton variant="secondary" action={markAllRead}>Marchează toate ca citite</ActionButton>}
        </>} />
      {rows.length === 0 ? <EmptyState icon={<Bell className="h-8 w-8" />} title={archived ? "Nicio notificare arhivată" : "Nu ai notificări"} description="Vei fi anunțat aici când apar ședințe, voturi, anunțuri sau schimbări importante." />
        : <Card><ul className="divide-y divide-line">{rows.map((n) => <NotificationItem key={n.id} n={n} />)}</ul></Card>}
    </>
  );
}

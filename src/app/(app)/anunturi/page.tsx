import { Download, Megaphone, Pin } from "lucide-react";
import { requireNotObserver } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, nameMap } from "@/lib/data";
import { Badge, Card, DemoBadge, EmptyState, PageHeader } from "@/components/ui";
import { AnnouncementActions, PublishAnnouncementButton } from "@/components/announcement-controls";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { AUDIENCE_LABEL, ROLE_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import type { Announcement, DocumentRow } from "@/lib/types";

export const metadata = { title: "Anunțuri" };

export default async function Page() {
  const s = await requireNotObserver();
  const supabase = await createClient();
  const [{ data }, { data: docs }, members] = await Promise.all([
    supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("published_at", { ascending: false }).limit(100),
    supabase.from("documents").select("*").not("announcement_id", "is", null),
    getMembers(supabase),
  ]);
  const rows = (data ?? []) as Announcement[]; const names = nameMap(members);
  const canPublish = s.can("manage_announcements");
  const picker = members.map((m) => ({ id: m.id, name: m.full_name, role: ROLE_LABEL[m.role] }));
  return (
    <>
      <RealtimeRefresh tables={["announcements"]} />
      <PageHeader title="Anunțuri" description="Comunicare internă a conducerii către Adunarea Generală." actions={canPublish && <PublishAnnouncementButton members={picker} />} />
      {rows.length === 0 ? <EmptyState icon={<Megaphone className="h-8 w-8" />} title="Niciun anunț" description={canPublish ? "Publică primul anunț: toți destinatarii vor fi notificați." : "Anunțurile conducerii vor apărea aici."} action={canPublish ? <PublishAnnouncementButton members={picker} /> : undefined} /> : (
        <div className="space-y-4">
          {rows.map((a) => (
            <Card key={a.id} className={`p-5 ${a.pinned ? "border-brand/40" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">{a.pinned && <Pin className="h-4 w-4 text-brand" aria-label="Fixat" />}{a.title} {a.is_demo && <DemoBadge />}</h2>
                  <p className="mt-0.5 text-xs text-muted">{a.author_id ? names[a.author_id] ?? "Conducere" : "Conducere"} · {formatDateTime(a.published_at)} · <Badge>{AUDIENCE_LABEL[a.audience]}</Badge></p>
                </div>
                {canPublish && <AnnouncementActions id={a.id} pinned={a.pinned} />}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{a.content}</p>
              {((docs ?? []) as DocumentRow[]).filter((d) => d.announcement_id === a.id).map((d) => (
                <a key={d.id} href={`/api/documente/${d.id}`} className="mt-3 mr-2 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-surface2"><Download className="h-4 w-4" aria-hidden />{d.file_name}</a>))}
            </Card>))}
        </div>)}
    </>
  );
}

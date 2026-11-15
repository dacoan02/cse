"use client";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Circle, CheckCircle2 } from "lucide-react";
import { ActionButton } from "@/components/confirm-action";
import { archiveNotification, openNotification, setNotificationRead } from "@/app/actions/notifications";
import { relativeTime } from "@/lib/format";
import type { NotificationRow } from "@/lib/types";

export function NotificationItem({ n }: { n: NotificationRow }) {
  const router = useRouter();
  const open = async () => { if (!n.is_read) await openNotification(n.id); if (n.link) router.push(n.link); else router.refresh(); };
  return (
    <li className={`flex items-start gap-3 px-4 py-3 ${n.is_read ? "" : "bg-brand/5"}`}>
      <span className="mt-1.5" aria-hidden>{n.is_read ? <CheckCircle2 className="h-4 w-4 text-muted" /> : <Circle className="h-4 w-4 fill-brand text-brand" />}</span>
      <button onClick={open} className="min-w-0 flex-1 cursor-pointer text-left">
        <p className={`text-sm ${n.is_read ? "" : "font-semibold"}`}>{n.title}{!n.is_read && <span className="sr-only"> (necitită)</span>}</p>
        {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>}
        <p className="mt-1 text-xs text-muted">{relativeTime(n.created_at)}{n.link ? " · Deschide" : ""}</p>
      </button>
      <div className="flex shrink-0 gap-1">
        {!n.is_archived && <ActionButton variant="ghost" size="sm" action={() => setNotificationRead(n.id, !n.is_read)}>{n.is_read ? "Necitită" : "Citită"}</ActionButton>}
        <ActionButton variant="ghost" size="sm" action={() => archiveNotification(n.id, !n.is_archived)}>
          {n.is_archived ? <ArchiveRestore className="h-4 w-4" aria-label="Restaurează" /> : <Archive className="h-4 w-4" aria-label="Arhivează" />}
        </ActionButton>
      </div>
    </li>
  );
}

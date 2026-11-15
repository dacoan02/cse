"use client";
import { Check, X } from "lucide-react";
import { ActionButton } from "@/components/confirm-action";
import { Badge } from "@/components/ui";
import { ATTENDANCE_LABEL } from "@/lib/labels";
import { ATTENDANCE_TONE } from "@/lib/tones";
import type { ClientActionResult } from "@/components/action-form";

export function MyAttendance({ status, locked, confirm, decline }: { status: string; locked: boolean; confirm: () => Promise<ClientActionResult>; decline: () => Promise<ClientActionResult> }) {
  const present = status === "present" || status === "present_by_organizer";
  return (
    <div className="space-y-3">
      <p className="text-sm">Răspunsul tău: <Badge tone={ATTENDANCE_TONE[status]}>{ATTENDANCE_LABEL[status]}</Badge></p>
      {!locked && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <ActionButton variant={present ? "success" : "secondary"} className="flex-1 py-3 text-base" action={confirm}><Check className="h-5 w-5" aria-hidden />CONFIRM PREZENȚA</ActionButton>
          <ActionButton variant={status === "absent" ? "danger" : "secondary"} className="flex-1 py-3 text-base" action={decline}><X className="h-5 w-5" aria-hidden />ANUNȚ ABSENȚA</ActionButton>
        </div>
      )}
      {locked && <p className="text-sm text-muted">Răspunsul nu mai poate fi modificat pentru această ședință.</p>}
    </div>
  );
}

export function CorrectAttendance({ present, absent, reset }: { present: () => Promise<ClientActionResult>; absent: () => Promise<ClientActionResult>; reset: () => Promise<ClientActionResult> }) {
  return (
    <div className="flex gap-1">
      <ActionButton size="sm" variant="ghost" action={present}>Prezent</ActionButton>
      <ActionButton size="sm" variant="ghost" action={absent}>Absent</ActionButton>
      <ActionButton size="sm" variant="ghost" action={reset}>Resetează</ActionButton>
    </div>
  );
}

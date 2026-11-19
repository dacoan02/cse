import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, MapPin, Video, FileText } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, nameMap } from "@/lib/data";
import { Badge, Card, CardHeader, DemoBadge, PageHeader, Table, Td, Th, Alert } from "@/components/ui";
import { QuorumPanel } from "@/components/quorum-panel";
import { MyAttendance, CorrectAttendance } from "@/components/attendance-controls";
import { MeetingActions, AgendaEditor, DocUploader } from "@/components/meeting-actions";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ATTENDANCE_LABEL, DOC_CATEGORY_LABEL, MEETING_STATUS_LABEL, MEETING_TYPE_LABEL, MODE_LABEL, VOTE_STATUS_LABEL } from "@/lib/labels";
import { ATTENDANCE_TONE, MEETING_TONE, VOTE_TONE } from "@/lib/tones";
import { formatBytes, formatDateTime, formatTime } from "@/lib/format";
import * as A from "@/app/actions/meetings";
import type { DocumentRow, Meeting, Vote } from "@/lib/types";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Meeting;
  const [agendaR, partsR, docsR, votesR, snapR, members, dirR] = await Promise.all([
    supabase.from("agenda_items").select("*").eq("meeting_id", id).order("position"),
    supabase.from("meeting_participants").select("id,status,responded_at,profile_id,representative_id,representatives(full_name,classes(name))").eq("meeting_id", id),
    supabase.from("documents").select("*").eq("meeting_id", id).order("created_at"),
    supabase.from("votes").select("*").eq("meeting_id", id).order("starts_at"),
    supabase.from("meeting_attendance_snapshot").select("*").eq("meeting_id", id).order("full_name"),
    getMembers(supabase),
    supabase.from("assembly_directory").select("profile_id,full_name,class_name"),
  ]);
  const dir = new Map(((dirR.data ?? []) as any[]).map((d) => [d.profile_id as string, d]));
  const agenda = agendaR.data ?? [];
  const parts = (partsR.data ?? []) as any[];
  const docs = (docsR.data ?? []) as DocumentRow[];
  const votes = (votesR.data ?? []) as Vote[];
  const snap = (snapR.data ?? []) as any[];
  const names = nameMap(members);
  const me = parts.find((p) => p.profile_id === s.userId);
  const open = m.status === "published" || m.status === "in_progress";
  const canManage = s.can("manage_meetings");
  const showQuorum = m.status !== "draft" && m.status !== "cancelled" && (s.canFollow || !!me);
  const agendaText = agenda.map((a: any) => a.title).join("\n");

  return (
    <>
      <RealtimeRefresh tables={["meetings", "meeting_participants"]} filter={{ meetings: `id=eq.${id}`, meeting_participants: `meeting_id=eq.${id}` }} />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{m.title} {m.is_demo && <DemoBadge />}</span>}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={MEETING_TONE[m.status]}>{MEETING_STATUS_LABEL[m.status]}</Badge><Badge>{MEETING_TYPE_LABEL[m.meeting_type]}</Badge><Badge>{MODE_LABEL[m.mode]}</Badge></span>}
        actions={<MeetingActions id={id} status={m.status} archived={m.archived} canManage={canManage}
          publish={A.publishMeetingAction.bind(null, id)} start={A.startMeetingAction.bind(null, id)} cancel={A.cancelMeetingAction.bind(null, id)}
          finish={A.finishMeetingAction.bind(null, id)} remove={A.deleteDraftMeetingAction.bind(null, id)} archive={A.archiveMeetingAction.bind(null, id, !m.archived)} />} />

      {m.status === "cancelled" && <div className="mb-4"><Alert tone="error" title="Ședința a fost anulată">{m.cancelled_reason ?? "Nu a fost indicat un motiv."}</Alert></div>}
      {m.status === "draft" && <div className="mb-4"><Alert tone="warn">Aceasta este o ciornă. Participanții nu au fost notificați și nu o văd.</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Detalii" />
            <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <Item label="Data și ora">{formatDateTime(m.starts_at)}{m.expected_end_at && <> – {formatTime(m.expected_end_at)}</>}</Item>
              <Item label="Locația"><span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-muted" aria-hidden />{m.location ?? "—"}</span></Item>
              {m.online_link && <Item label="Participare online"><a href={m.online_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><Video className="h-4 w-4" aria-hidden />Deschide linkul</a></Item>}
              <Item label="Motivul convocării" wide>{m.reason ?? "—"}</Item>
              {m.description && <Item label="Descriere" wide><span className="whitespace-pre-line">{m.description}</span></Item>}
              {m.started_at && <Item label="Început efectiv">{formatDateTime(m.started_at)}</Item>}
              {m.ended_at && <Item label="Încheiată">{formatDateTime(m.ended_at)}</Item>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Ordinea de zi" action={(s.can("edit_agenda") || canManage) && open || (s.can("edit_agenda") && m.status === "draft") ? <AgendaEditor agenda={agendaText} action={A.saveAgendaAction.bind(null, id)} canNotify={open} /> : undefined} />
            <div className="p-5">{agenda.length === 0 ? <p className="text-sm text-muted">Ordinea de zi nu a fost încă publicată.</p> :
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">{agenda.map((a: any) => <li key={a.id}>{a.title}</li>)}</ol>}</div>
          </Card>

          <Card>
            <CardHeader title="Documente" subtitle="Convocator, anexe, procesul-verbal" action={s.can("manage_documents") && m.status !== "draft" || s.can("manage_documents") ? <DocUploader action={A.uploadMeetingDocAction.bind(null, id)} secretaryPv={m.status === "held"} /> : undefined} />
            <ul className="divide-y divide-line">
              {docs.length === 0 && <li className="p-5 text-sm text-muted">Niciun document atașat.</li>}
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.title}</p><p className="text-xs text-muted">{DOC_CATEGORY_LABEL[d.category]} · {d.file_name} {formatBytes(d.size_bytes) && `· ${formatBytes(d.size_bytes)}`}</p></div>
                  <a href={`/api/documente/${d.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-surface2"><Download className="h-4 w-4" aria-hidden />Descarcă</a>
                </li>
              ))}
            </ul>
          </Card>

          {votes.length > 0 && <Card>
            <CardHeader title="Voturi desfășurate" />
            <ul className="divide-y divide-line">{votes.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <Link href={`/voturi/${v.id}`} className="font-medium text-brand hover:underline">{v.title}</Link>
                <span className="flex items-center gap-2">{v.result?.outcome && <span className="text-muted">{v.result.outcome}</span>}<Badge tone={VOTE_TONE[v.status]}>{VOTE_STATUS_LABEL[v.status]}</Badge></span>
              </li>))}</ul>
          </Card>}

          {m.status === "held" && <Card>
            <CardHeader title="Decizii adoptate" />
            <div className="whitespace-pre-line p-5 text-sm">{m.decisions ?? <span className="text-muted">Nu au fost consemnate decizii.</span>}</div>
          </Card>}
        </div>

        <div className="space-y-6">
          {me && open && <Card className="p-5">
            <h2 className="mb-3 text-base font-semibold">Prezența ta</h2>
            <MyAttendance status={me.status} locked={false} confirm={A.setAttendanceAction.bind(null, id, "present")} decline={A.setAttendanceAction.bind(null, id, "absent")} />
          </Card>}
          {me && !open && m.status === "held" && <Card className="p-5"><h2 className="mb-2 text-base font-semibold">Prezența ta</h2><Badge tone={ATTENDANCE_TONE[me.status]}>{ATTENDANCE_LABEL[me.status]}</Badge></Card>}
          {showQuorum && <QuorumPanel total={m.q_total} required={m.q_required} present={m.q_present} absent={m.q_absent} pending={m.q_pending} met={m.q_met} final={m.status === "held"} />}
        </div>
      </div>

      {s.canFollow && m.status !== "draft" && m.status !== "cancelled" && (
        <Card className="mt-6">
          <CardHeader title={m.status === "held" ? "Situația finală a prezenței" : "Participanți"} subtitle={m.status === "held" ? "Păstrată în arhivă la încheierea ședinței." : "Se actualizează în timp real."} />
          <Table>
            <thead><tr><Th>Nr.</Th><Th>Nume</Th><Th>Clasa</Th><Th>Stare</Th>{open && (s.can("manage_attendance")) && <Th>Corectare (organizator)</Th>}</tr></thead>
            <tbody>
              {(m.status === "held" && snap.length > 0
                ? snap.map((p, i) => ({ key: p.id, i, name: p.full_name, cls: p.class_name, status: p.status, pid: null as string | null }))
                : parts.map((p, i) => ({ key: p.id, i, name: p.representatives?.full_name ?? dir.get(p.profile_id)?.full_name ?? names[p.profile_id] ?? "—", cls: p.representatives?.classes?.name ?? dir.get(p.profile_id)?.class_name ?? "Conducere", status: p.status, pid: p.id as string }))
                  .sort((a, b) => a.name.localeCompare(b.name, "ro"))
              ).map((p, i) => (
                <tr key={p.key}>
                  <Td className="tabular-nums text-muted">{i + 1}</Td><Td className="font-medium">{p.name}</Td><Td>{p.cls}</Td>
                  <Td><Badge tone={ATTENDANCE_TONE[p.status]}>{ATTENDANCE_LABEL[p.status]}</Badge></Td>
                  {open && s.can("manage_attendance") && <Td>{p.pid && <CorrectAttendance present={A.setAttendanceForAction.bind(null, p.pid, "present")} absent={A.setAttendanceForAction.bind(null, p.pid, "absent")} reset={A.setAttendanceForAction.bind(null, p.pid, "no_response")} />}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt><dd className="mt-0.5">{children}</dd></div>;
}

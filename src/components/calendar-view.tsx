"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { ActionButton } from "@/components/confirm-action";
import { deleteCalendarEventAction } from "@/app/actions/content";

export interface CalEvent { id: string; title: string; start: string; end?: string | null; kind: string; href?: string; description?: string | null; location?: string | null; deletable?: boolean }
const KIND: Record<string, { label: string; dot: string }> = {
  ordinara: { label: "Ședință ordinară", dot: "bg-brand" }, extraordinara: { label: "Ședință extraordinară", dot: "bg-bad" }, proiect: { label: "Proiect", dot: "bg-ok" },
  activitate: { label: "Activitate", dot: "bg-warn" }, termen: { label: "Termen-limită", dot: "bg-bad" }, vot: { label: "Vot", dot: "bg-violet-500" }, eveniment: { label: "Eveniment", dot: "bg-sky-500" }, altele: { label: "Altele", dot: "bg-muted" },
};
const MODES = [["luna", "Lunar"], ["saptamana", "Săptămânal"], ["zi", "Zilnic"], ["lista", "Listă cronologică"]] as const;
const DAYS = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };

export function CalendarView({ events }: { events: CalEvent[] }) {
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("luna");
  const [cursor, setCursor] = useState(() => new Date());
  const [sel, setSel] = useState<CalEvent | null>(null);
  const [filter, setFilter] = useState<string>("");
  const evs = useMemo(() => events.filter((e) => !filter || e.kind === filter).sort((a, b) => a.start.localeCompare(b.start)), [events, filter]);
  const byDay = useMemo(() => { const m = new Map<string, CalEvent[]>(); for (const e of evs) { const k = ymd(new Date(e.start)); m.set(k, [...(m.get(k) ?? []), e]); } return m; }, [evs]);

  const move = (dir: number) => { const d = new Date(cursor); if (mode === "luna") d.setMonth(d.getMonth() + dir); else if (mode === "saptamana") d.setDate(d.getDate() + 7 * dir); else d.setDate(d.getDate() + dir); setCursor(d); };
  const title = mode === "luna" ? cursor.toLocaleDateString("ro-RO", { month: "long", year: "numeric" })
    : mode === "saptamana" ? `${startOfWeek(cursor).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })} – ${new Date(+startOfWeek(cursor) + 6 * 864e5).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}`
    : mode === "zi" ? cursor.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Toate evenimentele";

  const chip = (e: CalEvent) => (
    <button key={e.id} onClick={() => setSel(e)} className={`flex w-full cursor-pointer items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-xs hover:bg-surface2 ${sel?.id === e.id ? "bg-brand/10" : ""}`} title={e.title}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${KIND[e.kind]?.dot ?? "bg-muted"}`} aria-hidden /><span className="shrink-0 tabular-nums text-muted">{time(e.start)}</span><span className="truncate">{e.title}</span>
    </button>
  );

  let body;
  if (mode === "luna") {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = startOfWeek(first);
    const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    body = (
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line text-sm">
        {DAYS.map((d) => <div key={d} className="border-b border-line bg-surface2/60 px-2 py-1.5 text-xs font-semibold uppercase text-muted">{d}</div>)}
        {cells.map((d) => { const k = ymd(d); const list = byDay.get(k) ?? []; const out = d.getMonth() !== cursor.getMonth(); const today = k === ymd(new Date());
          return (<div key={k} className={`min-h-24 border-b border-r border-line p-1 ${out ? "bg-surface2/40 text-muted" : ""}`}>
            <button onClick={() => { setCursor(d); setMode("zi"); }} className={`mb-0.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-xs ${today ? "bg-brand text-white" : "hover:bg-surface2"}`} aria-label={d.toLocaleDateString("ro-RO", { dateStyle: "full" })}>{d.getDate()}</button>
            {list.slice(0, 3).map(chip)}{list.length > 3 && <button onClick={() => { setCursor(d); setMode("zi"); }} className="cursor-pointer px-1.5 text-xs text-brand">+{list.length - 3} altele</button>}
          </div>); })}
      </div>);
  } else if (mode === "saptamana") {
    const s0 = startOfWeek(cursor);
    body = (<div className="grid gap-2 md:grid-cols-7">{Array.from({ length: 7 }, (_, i) => { const d = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + i); const list = byDay.get(ymd(d)) ?? [];
      return (<div key={i} className="min-h-32 rounded-lg border border-line p-2"><p className={`mb-1 text-xs font-semibold ${ymd(d) === ymd(new Date()) ? "text-brand" : "text-muted"}`}>{DAYS[i]} {d.getDate()}</p>{list.length ? list.map(chip) : <p className="text-xs text-muted/70">—</p>}</div>); })}</div>);
  } else if (mode === "zi") {
    const list = byDay.get(ymd(cursor)) ?? [];
    body = list.length ? <ul className="space-y-2">{list.map((e) => <li key={e.id}><button onClick={() => setSel(e)} className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-left hover:bg-surface2"><span className={`h-3 w-3 rounded-full ${KIND[e.kind]?.dot}`} aria-hidden /><span className="tabular-nums text-sm text-muted">{time(e.start)}</span><span className="font-medium">{e.title}</span><Badge className="ml-auto">{KIND[e.kind]?.label}</Badge></button></li>)}</ul> : <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">Nimic planificat în această zi.</p>;
  } else {
    const groups = [...byDay.entries()];
    body = groups.length ? <div className="space-y-4">{groups.map(([k, list]) => <div key={k}><h3 className="mb-1 text-sm font-semibold">{new Date(k + "T12:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3><ul className="space-y-1">{list.map((e) => <li key={e.id}>{chip(e)}</li>)}</ul></div>)}</div> : <p className="p-8 text-center text-sm text-muted">Niciun eveniment.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" aria-label="Înapoi" onClick={() => move(-1)} className={mode === "lista" ? "hidden" : ""}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())} className={mode === "lista" ? "hidden" : ""}>Azi</Button>
            <Button variant="secondary" size="sm" aria-label="Înainte" onClick={() => move(1)} className={mode === "lista" ? "hidden" : ""}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h2 className="text-base font-semibold capitalize">{title}</h2>
          <div className="ml-auto flex flex-wrap gap-1" role="tablist" aria-label="Mod de vizualizare">
            {MODES.map(([k, l]) => <Button key={k} role="tab" aria-selected={mode === k} size="sm" variant={mode === k ? "primary" : "secondary"} onClick={() => setMode(k)}>{l}</Button>)}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <button onClick={() => setFilter("")} className={`cursor-pointer rounded px-1 ${filter === "" ? "font-semibold text-ink" : ""}`}>Toate</button>
          {Object.entries(KIND).map(([k, v]) => <button key={k} onClick={() => setFilter(filter === k ? "" : k)} className={`flex cursor-pointer items-center gap-1 rounded px-1 ${filter === k ? "font-semibold text-ink" : ""}`}><span className={`h-2 w-2 rounded-full ${v.dot}`} aria-hidden />{v.label}</button>)}
        </div>
        {body}
      </Card>
      <Card className="h-fit p-5 lg:sticky lg:top-20">
        {sel ? (
          <div className="space-y-3 text-sm">
            <Badge>{KIND[sel.kind]?.label}</Badge>
            <h3 className="text-base font-semibold">{sel.title}</h3>
            <p className="text-muted">{new Date(sel.start).toLocaleString("ro-RO", { dateStyle: "full", timeStyle: "short" })}{sel.end && ` – ${time(sel.end)}`}</p>
            {sel.location && <p>Locația: {sel.location}</p>}{sel.description && <p className="whitespace-pre-line">{sel.description}</p>}
            <div className="flex flex-wrap gap-2">{sel.href && <Link href={sel.href} className="inline-flex rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">Deschide detaliile</Link>}
              {sel.deletable && <ActionButton variant="secondary" size="sm" action={() => deleteCalendarEventAction(sel.id)}>Șterge evenimentul</ActionButton>}</div>
          </div>) : <p className="text-sm text-muted">Selectează un eveniment pentru a vedea detaliile.</p>}
      </Card>
    </div>
  );
}

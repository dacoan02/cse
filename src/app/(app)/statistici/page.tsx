import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadStats, resolvePeriod } from "@/lib/statistics";
import { Badge, Button, Card, CardHeader, Input, PageHeader, ProgressBar, Select, Stat, Table, Td, Th, buttonClass } from "@/components/ui";
import { BarsChart, TrendChart } from "@/components/stats-charts";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, PROJECT_STATUS_LABEL } from "@/lib/labels";

export const metadata = { title: "Statistici" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requirePerm("view_statistics");
  const supabase = await createClient();
  if (!s.year) return <p>Nu există un an școlar activ.</p>;
  const period = resolvePeriod(sp, s.year.starts_on);
  const st = await loadStats(supabase, s.year.id, { from: period.from, to: period.to, classId: sp.clasa, repId: sp.reprezentant });
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Statistici și rapoarte" description={`Calculate din datele reale ale sistemului · perioada: ${period.label}`}
        actions={s.can("view_statistics") && <>
          <a href={`/api/rapoarte?format=pdf&${qs}`} className={buttonClass("secondary")}>Exportă PDF</a>
          <a href={`/api/rapoarte?format=xlsx&${qs}`} className={buttonClass("secondary")}>Exportă Excel</a>
          <a href={`/api/rapoarte?format=csv&${qs}`} className={buttonClass("secondary")}>Exportă CSV</a></>} />
      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <Select name="perioada" aria-label="Perioadă" defaultValue={sp.perioada ?? ""}><option value="">Întregul an școlar</option><option value="luna">Luna curentă</option><option value="semestru">Ultimele 6 luni</option></Select>
        <Input type="date" name="de_la" aria-label="De la" defaultValue={sp.de_la} /><Input type="date" name="pana_la" aria-label="Până la" defaultValue={sp.pana_la} />
        <Select name="clasa" aria-label="Clasa" defaultValue={sp.clasa ?? ""}><option value="">Toate clasele</option>{st.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select name="reprezentant" aria-label="Reprezentant" defaultValue={sp.reprezentant ?? ""}><option value="">Toți reprezentanții</option>{st.representatives.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        <div className="flex gap-2"><Button type="submit" variant="secondary">Aplică</Button><Link href="/statistici" className="py-2 text-sm text-brand hover:underline">Resetează</Link></div>
      </form>

      <section aria-labelledby="h-sed" className="mb-8">
        <h2 id="h-sed" className="mb-3 text-lg font-semibold">Ședințe</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total ședințe" value={st.meetings.total} hint={`${st.meetings.ordinary} ordinare · ${st.meetings.extraordinary} extraordinare`} />
          <Stat label="Desfășurate / anulate" value={`${st.meetings.held} / ${st.meetings.cancelled}`} hint={`${st.meetings.upcoming} viitoare`} />
          <Stat label="Cvorum întrunit" value={`${st.meetings.quorumPct}%`} hint="din ședințele desfășurate" />
          <Stat label="Media prezenței" value={`${st.meetings.avgAttendance}%`} />
        </div>
        <Card><CardHeader title="Evoluția participării" subtitle="Procentul de prezenți la fiecare ședință desfășurată" /><div className="p-4"><TrendChart data={st.meetings.evolution} /></div></Card>
      </section>

      <section aria-labelledby="h-rep" className="mb-8">
        <h2 id="h-rep" className="mb-3 text-lg font-semibold">Reprezentanți</h2>
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Stat label="Reprezentanți activi" value={st.activeReps} />
          <Card><CardHeader title="Participare pe clase" /><div className="p-4"><BarsChart label="Participarea pe clase" unit="%" data={st.byClass.map((c) => ({ name: c.name, value: c.pct }))} /></div></Card>
        </div>
        <Card><Table><thead><tr><Th>Reprezentant</Th><Th>Clasa</Th><Th>Prezent</Th><Th>Absent</Th><Th>Fără răspuns</Th><Th>Participare</Th></tr></thead>
          <tbody>{st.representatives.length === 0 ? <tr><Td colSpan={6} className="text-center text-muted">Niciun reprezentant.</Td></tr> : st.representatives.map((r) => (
            <tr key={r.id}><Td className="font-medium">{r.name} {r.status !== "active" && <Badge>{r.status === "inactive" ? "inactiv" : "eliminat"}</Badge>}</Td><Td>{r.cls}</Td><Td className="tabular-nums">{r.present}</Td><Td className="tabular-nums">{r.absent}</Td><Td className="tabular-nums">{r.noResponse}</Td>
              <Td className="min-w-40"><div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={r.pct} label={`Participare ${r.name}`} tone={r.pct >= 75 ? "ok" : r.pct >= 50 ? "warn" : "bad"} /></div><span className="w-12 text-right text-xs tabular-nums">{r.held ? `${r.pct}%` : "—"}</span></div></Td></tr>))}</tbody></Table></Card>
      </section>

      <section aria-labelledby="h-vot" className="mb-8">
        <h2 id="h-vot" className="mb-3 text-lg font-semibold">Voturi</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Voturi organizate" value={st.votes.total} /><Stat label="Finalizate" value={st.votes.closed} /><Stat label="În desfășurare" value={st.votes.open} hint={`${st.votes.scheduled} programate`} /><Stat label="Participare medie" value={`${st.votes.avgParticipation}%`} />
        </div>
        {st.votes.results.length > 0 && <Card><Table><thead><tr><Th>Vot</Th><Th>Rezultat</Th><Th>Distribuția opțiunilor</Th><Th>Participare</Th></tr></thead>
          <tbody>{st.votes.results.map((v) => (<tr key={v.id}><Td><Link href={`/voturi/${v.id}`} className="font-medium text-brand hover:underline">{v.title}</Link> {v.secret && <Badge>Secret</Badge>}</Td><Td>{v.outcome}</Td>
            <Td className="text-xs">{v.options.map((o) => `${o.label}: ${o.count}`).join(" · ")}</Td><Td className="tabular-nums">{v.voted}/{v.eligible} ({v.participation}%)</Td></tr>))}</tbody></Table></Card>}
      </section>

      <section aria-labelledby="h-ses" className="mb-8">
        <h2 id="h-ses" className="mb-3 text-lg font-semibold">Sesizări și propuneri</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Total" value={st.feedback.total} /><Stat label="În analiză" value={st.feedback.inReview} /><Stat label="Soluționate" value={st.feedback.solved} /><Stat label="Respinse" value={st.feedback.rejected} /><Stat label="Timp mediu de soluționare" value={st.feedback.avgDays ? `${st.feedback.avgDays} zile` : "—"} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader title="După stare" /><div className="p-4"><BarsChart label="Sesizări după stare" data={Object.entries(st.feedback.byStatus).map(([k, v]) => ({ name: FEEDBACK_STATUS_LABEL[k], value: v }))} /></div></Card>
          <Card><CardHeader title="Problemele cel mai des semnalate" subtitle="După tip și după clasă" />
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2"><ul className="space-y-1">{Object.entries(st.feedback.byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k} className="flex justify-between"><span>{FEEDBACK_KIND_LABEL[k]}</span><span className="tabular-nums">{v}</span></li>)}{st.feedback.total === 0 && <li className="text-muted">Nicio sesizare.</li>}</ul>
              <ul className="space-y-1">{st.feedback.byClass.slice(0, 6).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums">{v}</span></li>)}</ul></div></Card>
        </div>
      </section>

      <section aria-labelledby="h-pro" className="mb-8">
        <h2 id="h-pro" className="mb-3 text-lg font-semibold">Proiecte și activități</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Proiecte create" value={st.projects.total} /><Stat label="În desfășurare" value={st.projects.running} /><Stat label="Finalizate" value={st.projects.finished} /><Stat label="Suspendate" value={st.projects.suspended} /><Stat label="Activități" value={st.projects.activities.total} hint={`${st.projects.activities.done} finalizate · ${st.projects.activities.running} în desfășurare`} />
        </div>
        {st.projects.list.filter((p) => p.status === "in_desfasurare").length > 0 && <Card><CardHeader title="Progresul proiectelor active" /><ul className="space-y-4 p-5">
          {st.projects.list.filter((p) => p.status === "in_desfasurare").map((p) => <li key={p.id}><div className="mb-1 flex justify-between text-sm"><Link href={`/proiecte/${p.id}`} className="text-brand hover:underline">{p.title}</Link><span className="tabular-nums text-muted">{p.progress}% · {PROJECT_STATUS_LABEL[p.status]}</span></div><ProgressBar value={p.progress} label={p.title} /></li>)}</ul></Card>}
      </section>
    </>
  );
}

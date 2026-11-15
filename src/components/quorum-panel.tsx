import { Card, CardHeader, ProgressBar, QuorumBadge } from "@/components/ui";
import { pct } from "@/lib/format";

/** Panou de cvorum. Valorile q_* sunt recalculate în baza de date la fiecare schimbare de prezență. */
export function QuorumPanel({ total, required, present, absent, pending, met, final }: {
  total: number; required: number; present: number; absent: number; pending: number; met: boolean; final?: boolean;
}) {
  const participation = pct(present, total);
  return (
    <Card aria-live="polite">
      <CardHeader title={final ? "Cvorum final" : "Cvorum"} subtitle="Prag = ⌊total reprezentanți activi / 2⌋ + 1. Doar cei cu statut „Prezent” contează." action={<QuorumBadge met={met} large />} />
      <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
        <Fig label="Reprezentanți activi" value={total} />
        <Fig label="Necesari pentru cvorum" value={required} />
        <Fig label="Prezenți" value={present} />
        <Fig label="Absenți declarați" value={absent} />
        <Fig label="Nu au răspuns" value={pending} />
      </div>
      <div className="px-5 pb-5">
        <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted">Procent de participare</span><span className="font-semibold tabular-nums">{participation}%</span></div>
        <ProgressBar value={participation} tone={met ? "ok" : "warn"} label="Procent de participare" />
        <p className="mt-2 text-sm text-muted">{met ? `Prag atins: ${present} prezenți din ${required} necesari.` : `Mai sunt necesare ${Math.max(required - present, 0)} confirmări de prezență pentru cvorum.`}</p>
      </div>
    </Card>
  );
}
function Fig({ label, value }: { label: string; value: number }) {
  return <div><div className="text-2xl font-semibold tabular-nums">{value}</div><div className="text-xs text-muted">{label}</div></div>;
}

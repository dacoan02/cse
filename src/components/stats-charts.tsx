"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 12, fill: "var(--muted)" } as const;
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" } };

export function TrendChart({ data }: { data: { label: string; pct: number; title: string }[] }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted">Nu există ședințe desfășurate în perioada aleasă.</p>;
  return (
    <div role="img" aria-label="Evoluția participării de la o ședință la alta" className="h-64">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="label" tick={axis} /><YAxis domain={[0, 100]} unit="%" tick={axis} />
        <Tooltip {...tip} formatter={(v) => [`${v}%`, "Participare"]} labelFormatter={(_, p) => p?.[0]?.payload?.title ?? ""} />
        <Line type="monotone" dataKey="pct" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart></ResponsiveContainer>
    </div>
  );
}
export function BarsChart({ data, unit = "", label, horizontal }: { data: { name: string; value: number }[]; unit?: string; label: string; horizontal?: boolean }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted">Nu există date.</p>;
  return (
    <div role="img" aria-label={label} className="h-64">
      <ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 24 : -12 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
        {horizontal ? <><XAxis type="number" tick={axis} unit={unit} /><YAxis type="category" dataKey="name" tick={axis} width={110} /></> : <><XAxis dataKey="name" tick={axis} interval={0} /><YAxis tick={axis} unit={unit} /></>}
        <Tooltip {...tip} formatter={(v) => [`${v}${unit}`, ""]} /><Bar dataKey="value" fill="var(--brand)" radius={4} isAnimationActive={false} />
      </BarChart></ResponsiveContainer>
    </div>
  );
}

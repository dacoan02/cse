import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Butoane ---------------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:brightness-110 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-surface2",
  ghost: "text-ink hover:bg-surface2",
  danger: "bg-bad text-white hover:brightness-110",
  success: "bg-ok text-white hover:brightness-110",
};
export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
    size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-4 py-2 text-sm",
    VARIANTS[variant], extra,
  );
}
type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md"; href?: string };
export function Button({ variant = "primary", size = "md", href, className, ...props }: ButtonProps) {
  if (href) return <Link href={href} className={buttonClass(variant, size, className)}>{props.children}</Link>;
  return <button type="button" {...props} className={buttonClass(variant, size, className)} />;
}

/* ---------------- Carduri și structură ---------------- */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,.04)]", className)} />;
}
export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div><h2 className="text-base font-semibold text-ink">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div>
      {action}
    </div>
  );
}
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-sm text-muted"><span>{label}</span>{icon}</div>
      <div className="mt-2 text-2xl font-semibold text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}
export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Alert({ tone = "info", children, title }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; title?: string }) {
  const tones = {
    info: "border-brand/30 bg-brand/5", warn: "border-warn/40 bg-warn/10", error: "border-bad/40 bg-bad/10", success: "border-ok/40 bg-ok/10",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-medium">{title}</p>}<div className={title ? "mt-0.5 text-muted" : ""}>{children}</div>
    </div>
  );
}

/* ---------------- Insigne ---------------- */
export type Tone = "neutral" | "brand" | "ok" | "warn" | "bad";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface2 text-muted border-line",
  brand: "bg-brand/10 text-brand border-brand/20",
  ok: "bg-ok/10 text-ok border-ok/25",
  warn: "bg-warn/10 text-warn border-warn/30",
  bad: "bg-bad/10 text-bad border-bad/25",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>{children}</span>;
}
export function DemoBadge() { return <Badge tone="warn">DEMO</Badge>; }

export function ProgressBar({ value, label, tone = "brand" }: { value: number; label?: string; tone?: "brand" | "ok" | "warn" | "bad" }) {
  const v = Math.max(0, Math.min(100, value));
  const color = { brand: "bg-brand", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progres"}
      className="h-2 w-full overflow-hidden rounded-full bg-surface2">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
    </div>
  );
}
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials || "?"}</span>
  );
}

/* ---------------- Tabele ---------------- */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>;
}
export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th {...props} scope="col" className={cn("whitespace-nowrap border-b border-line bg-surface2/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted", className)} />;
}
export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td {...props} className={cn("border-b border-line px-4 py-3 align-middle", className)} />;
}

/* ---------------- Câmpuri de formular ---------------- */
const inputBase = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60";
export function Field({ label, hint, required, children, htmlFor, className }: { label: string; hint?: string; required?: boolean; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">{label}{required && <span className="text-bad" aria-hidden> *</span>}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
export function Input({ className, ...props }: ComponentProps<"input">) { return <input {...props} className={cn(inputBase, className)} />; }
export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) { return <textarea rows={rows} {...props} className={cn(inputBase, className)} />; }
export function Select({ className, ...props }: ComponentProps<"select">) { return <select {...props} className={cn(inputBase, "pr-8", className)} />; }
export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2 text-sm", className)}>
      <input type="checkbox" {...props} className="mt-0.5 h-4 w-4 rounded border-line accent-[var(--brand)]" /><span>{label}</span>
    </label>
  );
}

/* ---------------- Cvorum: afișare text + culoare ---------------- */
export function QuorumBadge({ met, large }: { met: boolean; large?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-lg border font-semibold tracking-wide",
      large ? "px-4 py-2 text-base" : "px-2.5 py-1 text-xs", met ? TONES.ok : TONES.bad)}>
      <span aria-hidden>{met ? "✓" : "✕"}</span>{met ? "CVORUM ÎNTRUNIT" : "CVORUM NEÎNTRUNIT"}
    </span>
  );
}

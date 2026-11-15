import Link from "next/link";
import type { ReactNode } from "react";
import { Landmark } from "lucide-react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/login" className="mb-8 flex items-center justify-center gap-2 text-ink">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white"><Landmark className="h-5 w-5" aria-hidden /></span>
          <span className="text-lg font-semibold">Consiliul Școlar al Elevilor</span>
        </Link>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}

"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Alert } from "@/components/ui";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import type { ClientActionResult } from "@/components/action-form";

/** Buton cu confirmare înaintea operațiunilor ireversibile sau cu impact (anulare, ștergere, publicare). */
export function ConfirmAction({
  action, children, title, description, confirmLabel = "Confirmă", variant = "danger", triggerVariant = "secondary", size = "md", successMessage = "Acțiune efectuată.",
}: {
  action: () => Promise<ClientActionResult>; children: ReactNode; title: string; description: ReactNode;
  confirmLabel?: string; variant?: "danger" | "primary" | "success"; triggerVariant?: "primary" | "secondary" | "ghost" | "danger" | "success"; size?: "sm" | "md"; successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button variant={triggerVariant} size={size} onClick={() => { setError(null); setOpen(true); }}>{children}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="space-y-4">
          <div className="text-sm text-muted">{description}</div>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Renunță</Button>
            <Button variant={variant} disabled={pending} onClick={() => start(async () => {
              const r = await action().catch(() => ({ ok: false as const, error: "Eroare de conexiune. Încearcă din nou." }));
              if (r.ok) { toast.success(r.message ?? successMessage); setOpen(false); if (r.redirectTo) router.push(r.redirectTo); else router.refresh(); }
              else { setError(r.error); toast.error(r.error); }
            })}>{pending ? "Se procesează…" : confirmLabel}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Buton simplu care apelează o acțiune de server fără confirmare (ex. „Confirm prezența”). */
export function ActionButton({
  action, children, variant = "primary", size = "md", successMessage, className, disabled,
}: {
  action: () => Promise<ClientActionResult>; children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md"; successMessage?: string; className?: string; disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button variant={variant} size={size} className={className} disabled={pending || disabled} aria-busy={pending} onClick={() => start(async () => {
      const r = await action().catch(() => ({ ok: false as const, error: "Eroare de conexiune. Încearcă din nou." }));
      if (r.ok) { toast.success(r.message ?? successMessage ?? "Salvat."); router.refresh(); } else toast.error(r.error);
    })}>{children}</Button>
  );
}

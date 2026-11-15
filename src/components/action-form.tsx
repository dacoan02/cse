"use client";
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { useToast } from "@/components/toast";

export type ClientActionResult = { ok: true; message?: string; redirectTo?: string; data?: unknown } | { ok: false; error: string };

const PendingCtx = createContext(false);
export const useFormPending = () => useContext(PendingCtx);

/**
 * Formular care apelează o acțiune de server, afișează erori, confirmă prin toast și reîmprospătează pagina.
 * Folosește <SubmitButton> în interior pentru starea de încărcare.
 */
export function ActionForm({
  action, children, successMessage = "Salvat cu succes.", resetOnSuccess = false, onSuccess, className,
}: {
  action: (fd: FormData) => Promise<ClientActionResult>;
  children: ReactNode; successMessage?: string; resetOnSuccess?: boolean;
  onSuccess?: (r: ClientActionResult) => void; className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <PendingCtx.Provider value={pending}>
      <form ref={ref} className={className ?? "space-y-4"} onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          let r: ClientActionResult;
          try { r = await action(fd); } catch { r = { ok: false, error: "A apărut o eroare de conexiune. Încearcă din nou." }; }
          if (r.ok) {
            toast.success(r.message ?? successMessage);
            if (resetOnSuccess) ref.current?.reset();
            if (r.redirectTo) router.push(r.redirectTo); else router.refresh();
            onSuccess?.(r);
          } else { setError(r.error); toast.error(r.error); }
        });
      }}>
        {error && <Alert tone="error">{error}</Alert>}
        {children}
      </form>
    </PendingCtx.Provider>
  );
}

export function SubmitButton({ children, variant = "primary", pendingLabel = "Se salvează…", className, onClick }: {
  children: ReactNode; variant?: "primary" | "danger" | "success" | "secondary"; pendingLabel?: string; className?: string; onClick?: () => void;
}) {
  const pending = useFormPending();
  return <Button type="submit" variant={variant} disabled={pending} className={className} aria-busy={pending} onClick={onClick}>{pending ? pendingLabel : children}</Button>;
}

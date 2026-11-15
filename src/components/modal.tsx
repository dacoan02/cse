"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { ActionForm, SubmitButton, type ClientActionResult } from "@/components/action-form";

/** Dialog nativ (<dialog>) cu captură de focus, Escape și backdrop. */
export function Modal({ open, onClose, title, description, children, wide }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-line bg-surface p-0 shadow-2xl`}>
      {open && (
        <div className="max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
            <div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-0.5 text-sm text-muted">{description}</p>}</div>
            <button aria-label="Închide" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-ink"><X className="h-5 w-5" /></button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Buton care deschide un formular în dialog; la succes, dialogul se închide. */
export function ModalForm({
  trigger, title, description, action, submitLabel = "Salvează", successMessage, children, wide,
  triggerVariant = "primary", triggerSize = "md", submitVariant = "primary",
}: {
  trigger: ReactNode; title: string; description?: string; action: (fd: FormData) => Promise<ClientActionResult>;
  submitLabel?: string; successMessage?: string; children: ReactNode; wide?: boolean;
  triggerVariant?: "primary" | "secondary" | "ghost" | "danger" | "success"; triggerSize?: "sm" | "md";
  submitVariant?: "primary" | "danger" | "success";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>{trigger}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} wide={wide}>
        <ActionForm action={action} successMessage={successMessage} onSuccess={() => setOpen(false)}>
          {children}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>Renunță</Button>
            <SubmitButton variant={submitVariant}>{submitLabel}</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";

/** Accessible modal confirmation — replaces window.confirm() for destructive/
 * consequential actions (native confirm() can't be styled, blocks the JS
 * thread, and behaves inconsistently across browsers/embedded webviews). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div className="w-full max-w-sm bg-jcf-panel border border-white/15 rounded-sm p-5">
        <h2 id="confirm-dialog-title" className="font-display uppercase tracking-wide text-white mb-2">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="text-jcf-gray text-sm mb-5">
          {description}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-sm text-sm font-semibold uppercase tracking-wide ${
              destructive ? "bg-jcf-danger text-white" : "bg-jcf-gold text-jcf-black"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

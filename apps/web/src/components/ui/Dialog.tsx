import { useEffect, useRef, type ReactNode } from "react";
import Button from "@/components/ui/Button";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export default function Dialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  isConfirming = false,
  onConfirm,
  onCancel,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Focus moves to the destructive/confirm action on open
      confirmRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "Enter" && !isConfirming) {
      onConfirm();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      className="m-auto w-[90vw] max-w-sm rounded-[--radius-lg] border-none p-0 shadow-[--shadow-modal] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
    >
      <div className="p-5">
        <h2 id="dialog-title" className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
        {description && (
          <p id="dialog-description" className="mt-2 text-sm text-text-secondary">
            {description}
          </p>
        )}
        {children}
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={destructive ? "destructive" : "primary"}
            fullWidth
            onClick={onConfirm}
            loading={isConfirming}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

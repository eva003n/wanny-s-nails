/**
 * §6.2 Bottom Sheet
 *
 * --shadow-sheet, --radius-lg top-only
 * translateY(100%) → translateY(0) animation at --duration-slow, --ease-out
 * §10: Focus trap, return focus to trigger on close
 * §2.6: Animations ≤ 300ms
 */
import { useEffect, useRef } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      /* §10: Trap focus inside sheet */
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
          return;
        }
        if (e.key === "Tab" && sheetRef.current) {
          const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      /* Focus the first focusable element */
      requestAnimationFrame(() => {
        const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      });

      return () => document.removeEventListener("keydown", handleKeyDown);
    } else {
      /* §10: Return focus to trigger */
      previousFocusRef.current?.focus();
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Bottom sheet"}
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
        style={{
          transition: "opacity var(--duration-standard) var(--ease-out)",
        }}
      />

      {/* Sheet content */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 overflow-auto"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          boxShadow: "var(--shadow-modal)",
          maxHeight: "85vh",
          /* §2.6: Modal open animation — translateY(100%) → translateY(0) with --ease-out */
          animation: "sheetSlideUp var(--duration-slow) var(--ease-out) forwards",
        }}
      >
        {/* Handle indicator */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "var(--color-text-tertiary)",
            }}
          />
        </div>

        {/* Header */}
        {title && (
          <div className="px-[var(--space-16)] pb-[var(--space-8)]">
            <h2
              style={{
                fontSize: "17px",
                lineHeight: "22px",
                letterSpacing: "-0.1px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              {title}
            </h2>
          </div>
        )}

        {/* Body */}
        <div className="px-[var(--space-16)] pb-[calc(var(--space-16)+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
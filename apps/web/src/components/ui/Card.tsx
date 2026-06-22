/**
 * §3.2 Card Anatomy
 *
 * Standard: --radius-md, --shadow-card, padding --space-16
 * Hero: --radius-lg
 * Appointment (ribbon): --radius-xl
 * Modal Sheet: --radius-lg top-only, --shadow-modal
 */
import { clsx } from "clsx";

interface CardProps {
  variant?: "standard" | "hero" | "ribbon" | "sheet";
  children: React.ReactNode;
  className?: string;
  /** For clickable cards (navigation) */
  onClick?: () => void;
}

export default function Card({ variant = "standard", children, className, onClick }: CardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={clsx(
        "bg-[var(--color-surface)] border border-[var(--color-border)]",
        onClick && "cursor-pointer",
        className,
      )}
      style={{
        borderRadius:
          variant === "ribbon"
            ? "var(--radius-xl)"
            : variant === "sheet"
              ? "var(--radius-lg) var(--radius-lg) 0 0"
              : variant === "hero"
                ? "var(--radius-lg)"
                : "var(--radius-md)",
        boxShadow:
          variant === "sheet"
            ? "var(--shadow-modal)"
            : "var(--shadow-card)",
        padding: "var(--space-16)",
      }}
    >
      {children}
    </div>
  );
}
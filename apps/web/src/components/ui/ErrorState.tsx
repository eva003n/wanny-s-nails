/**
 * §7.3 Error States
 *
 * Red warning icon 48px
 * Heading explains what happened in plain terms
 * Body with clear path forward
 * Retry CTA (primary button)
 * Never say "An error occurred" with no path forward
 */
import { AlertTriangle } from "lucide-react";
import Button from "./Button";

interface ErrorStateProps {
  heading?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({
  heading = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center px-6 py-12 text-center"
    >
      {/* §7.3 Red warning icon — 48px — Lucide */}
      <AlertTriangle
        size={48}
        strokeWidth={1.5}
        className="text-error"
        aria-hidden="true"
      />

      {/* §7.3 Heading */}
      <h3 className="text-lg font-semibold text-text-primary mt-4 mb-2">
        {heading}
      </h3>

      {/* §7.3 Body */}
      <p className="text-base text-text-secondary max-w-xs mb-6">
        {message}
      </p>

      {/* §7.3 Retry CTA — --btn-primary, full width */}
      {onRetry && (
        <div className="w-full max-w-[320px]">
          <Button onClick={onRetry}>Try Again</Button>
        </div>
      )}
    </div>
  );
}
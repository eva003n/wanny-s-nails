import { useOnline } from "@/hooks/useOnline";
import { useEffect, useRef, useState, } from "react";




interface OfflineFallbackProps {
  /** What the user was trying to do — shown in the message for context. */
  context?: string;
  /** Render your app's normal content here once connectivity returns. */
  children?: React.ReactNode;
}

export default function OfflineFallback({
  context,
  children,
}: OfflineFallbackProps) {
  const { isOnline, checking, probe } = useOnline();
  const [retryCount, setRetryCount] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

  
  // Auto-retry with gentle backoff: 4s, 8s, 16s, capped at 30s
  useEffect(() => {
    if (isOnline) return;

    const delay = Math.min(4000 * 2 ** retryCount, 30000);
    timeoutRef.current = setTimeout(() => {
      probe();
      setRetryCount((c) => c + 1);
      setPulseKey((k) => k + 1);
    }, delay);

    return () => clearTimeout(timeoutRef.current);
  }, [isOnline, retryCount, probe]);

  const handleManualRetry = () => {
    setPulseKey((k) => k + 1);
    probe();
  };

  if (isOnline) return <>{children}</>;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="w-full max-w-sm text-center">
        {/* Signature element — a "settling" ring, evoking polish settling
            into stillness rather than a generic spinner/wifi icon. Two
            rings: an outer one that expands and fades on each retry
            pulse, and a still center that only moves when truly checking. */}
        <div className="relative mx-auto mb-6 h-20 w-20">
          <span
            key={pulseKey}
            className="absolute inset-0 rounded-full motion-safe:animate-[offlinePulse_1.8s_ease-out]"
            style={{
              border: "1.5px solid var(--color-info)",
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full"
            style={{
              background: "var(--color-info-bg)",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: "var(--color-info)",
                transition: "transform 400ms var(--ease-out)",
                transform: checking ? "scale(0.9)" : "scale(1)",
              }}
              aria-hidden="true"
            >
              <path d="M12 20a1 1 0 100-2 1 1 0 000 2z" />
              <path d="M8.5 15.5a5 5 0 017 0" />
              <path d="M5 12a9.5 9.5 0 0114 0" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          </div>
        </div>

        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          You're offline
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {context
            ? `Can't load ${context} right now. `
            : "Can't reach the server right now. "}
          Cached pages are still available — new bookings and payments will sync
          once you're back online.
        </p>

        <button
          onClick={handleManualRetry}
          disabled={checking}
          className="mt-6 w-full rounded-(--radius-md,10px) px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-60"
          style={{
            background: "var(--color-info)",
            color: "var(--color-on-info, #fff)",
          }}
        >
          {checking ? "Checking…" : "Try again"}
        </button>

        <p
          className="mt-3 text-xs"
          style={{
            color: "var(--color-text-tertiary, var(--color-text-secondary))",
          }}
        >
          {retryCount === 0
            ? "We'll keep checking automatically."
            : `Checked ${retryCount} time${retryCount === 1 ? "" : "s"} — still offline.`}
        </p>
      </div>

      <style>{`
        @keyframes offlinePulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-\\[offlinePulse_1\\.8s_ease-out\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

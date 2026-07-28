/**
 * ServiceWorkerPrompt — modal overlay for SW update / offline-ready events
 *
 * Replaces the inline `<div className="toast">` in App.tsx that was disrupting
 * the page layout. Renders as a fixed-position overlay (single purpose) so it
 * never interferes with normal content flow.
 *
 * States:
 *  - offlineReady  → "App ready to work offline" — auto-dismisses after 4 s
 *  - needRefresh   → "New version available" + Reload button (persistent)
 */
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Button from "@/components/ui/Button";

interface ServiceWorkerPromptProps {
  needRefresh: boolean;
  offlineReady: boolean;
  setOfflineReady: Dispatch<SetStateAction<boolean>>;
  setNeedRefresh: Dispatch<SetStateAction<boolean>>;
  onReload: () => void;
}

export default function ServiceWorkerPrompt({
  needRefresh,
  offlineReady,
  // setOfflineReady,
  // setNeedRefresh,
  onReload,
}: ServiceWorkerPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // console.log(needRefresh)
  /* Auto-dismiss the offline-ready toast after 4 s */
  useEffect(() => {
    if (!offlineReady || needRefresh) return;

    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => setDismissed(true), 200);
    }, 4000);

    return () => {
      clearTimeout(timer);
      // setOfflineReady(false);
    };
  }, [offlineReady, needRefresh]);

  /* Focus the reload button when the prompt opens */
  useEffect(() => {
    if (needRefresh) {
      requestAnimationFrame(() => confirmRef.current?.focus());
    }

    return () => {
      // setNeedRefresh(false);
    };
  }, [needRefresh]);

  const show = (needRefresh || offlineReady) && !dismissed;
  if (!show) return null;

  const isUpdate = needRefresh;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isUpdate ? "New version available" : "Offline ready"}
      className="fixed inset-0 z-50 flex  justify-center p-4 items-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        style={{
          animation: "fadeIn 200ms var(--ease-out) forwards",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-modal)",
          animation: exiting
            ? "promptExit 200ms var(--ease-in) forwards"
            : "promptEnter 250ms var(--ease-out) forwards",
        }}
      >
        <div className="p-5">
          {/* Icon */}
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: isUpdate
                ? "var(--color-info-bg)"
                : "var(--color-success-bg)",
            }}
          >
            {isUpdate ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--color-info)" }}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--color-success)" }}
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            )}
          </div>

          {/* Text */}
          <h3
            className="text-center text-base font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {isUpdate ? "Update Available" : "Ready for Offline"}
          </h3>
          <p
            className="mt-1 text-center text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {isUpdate
              ? "A new version of the app is available. Reload to get the latest features and fixes."
              : "The app is now fully cached and ready to work offline."}
          </p>

          {/* Actions */}
          <div className="mt-5 flex gap-3">
            {!isUpdate && (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setDismissed(true)}
              >
                Got it
              </Button>
            )}
            {isUpdate && (
              <>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setDismissed(true)}
                >
                  Later
                </Button>
                <Button
                  ref={confirmRef}
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    onReload()
                  }}
                >
                  Reload
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

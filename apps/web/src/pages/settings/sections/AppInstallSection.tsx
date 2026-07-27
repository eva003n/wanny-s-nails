import { Button, Card } from "@/components/ui";
import { useInstallPromptContext } from "@/hooks/useInstallPrompt";

function DownloadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--color-primary)" }}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function AppInstallSection() {
  const { isInstallable, promptInstall } = useInstallPromptContext();

  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-12)",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius-lg)",
            background: "var(--color-primary-bg, rgba(99, 102, 241, 0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DownloadIcon />
        </div>

        {/* Title */}
        <div>
          <p
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Install App
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              margin: "var(--space-4) 0 0",
              lineHeight: 1.5,
            }}
          >
            Add Wanny's Nails to your home screen for quick access, offline
            support, and a faster experience.
          </p>
        </div>

        {/* Status badge */}
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            padding: "var(--space-2) var(--space-8)",
            borderRadius: "var(--radius-sm)",
            background: isInstallable
              ? "var(--color-success-bg, rgba(34, 197, 94, 0.1))"
              : "var(--color-surface-raised, rgba(0,0,0,0.04))",
            color: isInstallable
              ? "var(--color-success, #16a34a)"
              : "var(--color-text-tertiary)",
          }}
        >
          {isInstallable ? "Ready to install" : "Already installed"}
        </span>

        {/* Install button */}
        <Button
          variant="primary"
          onClick={promptInstall}
          disabled={!isInstallable}
          fullWidth
        >
          Install App
        </Button>
      </div>
    </Card>
  );
}
/**
 * §5.2 Screen Header
 *
 * Height: 44px (navigation bar) + safe area
 * Title: --type-h3, centered
 * Back: "‹ Back" — --type-body, --color-accent
 * Primary action: text button or icon in --color-accent
 * §10 Accessibility: semantic HTML, aria-label
 */
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  /** If provided, shows a back chevron + "Back" text */
  showBack?: boolean;
  /** Primary action element displayed right-aligned */
  action?: React.ReactNode;
}

export default function PageHeader({ title, showBack = true, action }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 flex items-center justify-between"
      style={{
        height: "44px",
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "var(--space-16)",
        paddingRight: "var(--space-16)",
        background: "var(--color-canvas)",
      }}
    >
      {/* Left: Back button */}
      <div className="flex items-center" style={{ minWidth: 80 }}>
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="flex min-h-[44px] items-center"
            style={{
              fontSize: "16px",
              lineHeight: "22px",
              fontWeight: 400,
              color: "var(--color-accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Go back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: 2 }}
            >
              <polyline points="12 4 6 10 12 16" />
            </svg>
            Back
          </button>
        )}
      </div>

      {/* Center: Title — §5.2 —type-h3, centered */}
      <h1
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "17px",
          lineHeight: "22px",
          letterSpacing: "-0.1px",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </h1>

      {/* Right: Primary action */}
      <div className="flex items-center justify-end" style={{ minWidth: 80 }}>
        {action}
      </div>
    </header>
  );
}
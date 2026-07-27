// src/components/PushOptIn.tsx
import Toggle from "@/components/ui/Toggle";

interface SubscriptionInfo {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
}

interface PushOptInProps {
  isSubscribed: boolean;
  status: string;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  subscriptionInfo: SubscriptionInfo | null;
  onSubscribe: () => void;
  onUnSubscribe: () => void;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

function parseBrowser(userAgent: string | null): string {
  if (!userAgent) return "Browser";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "Browser";
}

export function PushOptIn({
  isSubscribed,
  status,
  loading,
  initializing,
  error,
  subscriptionInfo,
  onSubscribe,
  onUnSubscribe,
}: PushOptInProps) {
  // ── Initializing (checking server) ────────────────────────────
  if (initializing) {
    return (
      <div className="push-optin-card">
        <div className="push-optin-row">
          <div className="push-optin-info">
            <span className="push-optin-title">Push Notifications</span>
            <span className="push-optin-desc">Checking subscription status…</span>
          </div>
          <Toggle checked={false} onChange={() => {}} disabled ariaLabel="Checking…" />
        </div>
      </div>
    );
  }

  // ── Unsupported ───────────────────────────────────────────────
  if (status === "unsupported") {
    return (
      <div className="push-optin-card">
        <div className="push-optin-row">
          <div className="push-optin-info">
            <div className="push-optin-icon-row">
              <span className="push-optin-icon push-optin-icon-warn">⚠️</span>
              <span className="push-optin-title">Not Supported</span>
            </div>
            <span className="push-optin-desc">
              Push notifications aren't supported on this device or browser.
            </span>
          </div>
          <Toggle checked={false} onChange={() => {}} disabled ariaLabel="Notifications not supported" />
        </div>
      </div>
    );
  }

  // ── Denied ────────────────────────────────────────────────────
  if (status === "denied") {
    return (
      <div className="push-optin-card">
        <div className="push-optin-row">
          <div className="push-optin-info">
            <div className="push-optin-icon-row">
              <span className="push-optin-icon push-optin-icon-error">🔕</span>
              <span className="push-optin-title">Notifications Blocked</span>
            </div>
            <span className="push-optin-desc push-optin-desc-error">
              Notifications are blocked. Enable them in your browser's site settings to receive booking alerts.
            </span>
          </div>
          <Toggle checked={false} onChange={() => {}} disabled ariaLabel="Notifications blocked" />
        </div>
      </div>
    );
  }

  // ── Default (permission not yet asked) ────────────────────────
  if (status === "default" && !isSubscribed) {
    return (
      <div className="push-optin-card">
        <div className="push-optin-row">
          <div className="push-optin-info">
            <div className="push-optin-icon-row">
              <span className="push-optin-icon push-optin-icon-info">🔔</span>
              <span className="push-optin-title">Enable Push Notifications</span>
            </div>
            <span className="push-optin-desc">
              Get instant alerts for new bookings, cancellations, reschedules, and other important updates.
            </span>
          </div>
          <Toggle
            checked={false}
            onChange={onSubscribe}
            disabled={loading}
            ariaLabel="Enable notifications"
          />
        </div>
      </div>
    );
  }

  // ── Subscribed (confirmed via server) ─────────────────────────
  if (isSubscribed && status === "subscribed") {
    return (
      <div className="push-optin-card">
        <div className="push-optin-row">
          <div className="push-optin-info">
            <div className="push-optin-icon-row">
              <span className="push-optin-icon push-optin-icon-success">✅</span>
              <span className="push-optin-title">Push Notifications Active</span>
            </div>
            <span className="push-optin-desc push-optin-desc-success">
              You'll receive push notifications for booking updates.
            </span>
            {subscriptionInfo && (
              <span className="push-optin-meta">
                Subscribed on {parseBrowser(subscriptionInfo.userAgent)} &middot;{" "}
                {formatDate(subscriptionInfo.createdAt)}
              </span>
            )}
          </div>
          <Toggle
            checked={true}
            onChange={onUnSubscribe}
            disabled={loading}
            ariaLabel="Disable notifications"
          />
        </div>
      </div>
    );
  }

  // ── Unsubscribed (permission granted but no server subscription) ──
  if (!isSubscribed && (status === "unsubscribed" || status === "granted")) {
    return (
      <div className="push-optin-card">
        <div className="push-optin-row">
          <div className="push-optin-info">
            <div className="push-optin-icon-row">
              <span className="push-optin-icon push-optin-icon-inactive">🔕</span>
              <span className="push-optin-title">Push Notifications</span>
            </div>
            <span className="push-optin-desc">
              You've granted permission but aren't subscribed. Toggle on to receive booking alerts.
            </span>
          </div>
          <Toggle
            checked={false}
            onChange={onSubscribe}
            disabled={loading}
            ariaLabel="Enable notifications"
          />
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────
  if (error) {
    return (
      <div className="push-optin-card">
        <div className="push-optin-row">
          <div className="push-optin-info">
            <div className="push-optin-icon-row">
              <span className="push-optin-icon push-optin-icon-error">❌</span>
              <span className="push-optin-title">Something went wrong</span>
            </div>
            <span className="push-optin-desc push-optin-desc-error">{error}</span>
            <button
              className="push-optin-retry"
              onClick={isSubscribed ? onUnSubscribe : onSubscribe}
              disabled={loading}
            >
              {loading ? "Retrying…" : "Try again"}
            </button>
          </div>
          <Toggle
            checked={isSubscribed}
            onChange={isSubscribed ? onUnSubscribe : onSubscribe}
            disabled={loading}
            ariaLabel="Retry"
          />
        </div>
      </div>
    );
  }

  // ── Loading state (fallback) ──────────────────────────────────
  return (
    <div className="push-optin-card">
      <div className="push-optin-row">
        <div className="push-optin-info">
          <span className="push-optin-title">Push Notifications</span>
          <span className="push-optin-desc">
            {loading
              ? isSubscribed
                ? "Disabling…"
                : "Enabling…"
              : "Manage push notifications"}
          </span>
        </div>
        <Toggle
          checked={isSubscribed}
          onChange={isSubscribed ? onUnSubscribe : onSubscribe}
          disabled={loading}
          ariaLabel={isSubscribed ? "Disable notifications" : "Enable notifications"}
        />
      </div>
      {loading && (
        <div className="push-optin-progress">
          <div className="push-optin-progress-bar" />
        </div>
      )}
    </div>
  );
}
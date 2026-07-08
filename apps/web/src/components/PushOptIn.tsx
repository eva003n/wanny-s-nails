// src/components/PushOptIn.tsx
import { usePushSubscription } from "@/hooks/usePushSubscription";
import Toggle from "@/components/ui/Toggle";

export function PushOptIn() {
  const { status, loading, error, subscribe } = usePushSubscription();

  if (status === "unsupported") {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Push notifications aren't supported on this device.
        </p>
        <Toggle
          checked={false}
          onChange={() => {}}
          ariaLabel="Notifications disabled"
          disabled
        />
      </div>
    );
  }

  if (status === "granted" || status === "subscribed") {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-green-600">Notifications enabled ✓</p>
        <Toggle
          checked={true}
          onChange={() => {}}
          ariaLabel="Notifications enabled"
          disabled
        />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-red-500" >
          Notifications are blocked. Enable them in your browser's site
          settings.
        </p>
        <Toggle
          checked={false}
          onChange={() => {}}
          ariaLabel="Notifications disabled"
          disabled
        />
        -
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-sm flex items-center justify-between"
        style={{
          // fontWeight: 500,
          color: "var(--color-text-secondary)",
          margin: 0,
        }}
      >
        <p>
          Manage push notification settings for booking updates and important
          alerts.
        </p>
        <Toggle
          checked={false}
          onChange={() => subscribe()}
          ariaLabel="Enable notifications"
          disabled={loading}
        />
        {/* <span className="text-sm text-gray-700">
          {loading ? "Enabling…" : "Enable notifications"}
        </span> */}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

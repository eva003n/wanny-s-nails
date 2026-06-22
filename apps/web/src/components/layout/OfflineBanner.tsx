import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { useUiStore } from "@/store/ui.store";

export default function OfflineBanner() {
  const isOnline = useOnline();
  const sseBannerVisible = useUiStore((s) => s.sseBannerVisible);

  if (isOnline && !sseBannerVisible) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 bg-warning-bg px-4 py-2 text-sm font-medium text-warning"
      role="status"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      {!isOnline ? "You're offline — showing cached data" : "Live updates paused — reconnecting…"}
    </div>
  );
}

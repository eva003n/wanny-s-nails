import { WifiIcon, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import clsx from "clsx";

export default function OfflineBanner() {
  const {isOnline} = useOnline();


  return (
    <div
      className={clsx(`
        flex items-center justify-center gap-2  px-4 py-2 text-sm font-medium ${isOnline? "text-green-500": "text-warning"}
        `)}
        title={isOnline? "Online mode": "Offline mode"}
      role="status"
    >
      {!isOnline ? (
        <WifiOff
          className="h-4 w-4"
          aria-hidden="true"
        />
      ) : (
        <WifiIcon />
      )}
    </div>
  );
}

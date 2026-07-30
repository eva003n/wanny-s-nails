import { useState, useEffect, useCallback } from "react";
/**
 * useOnlineStatus
 * Tracks browser connectivity, plus an active "are we really connected"
 * probe — navigator.onLine can lie (e.g. connected to a wifi with no
 * internet), so we back it up with a lightweight periodic fetch.
 */
export function useOnline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [checking, setChecking] = useState(false);

  const probe = useCallback(async () => {
    setChecking(true);
    try {
      // HEAD request to your own origin — cheap, same-origin, no CORS issues.
      // Swap the path for a real lightweight endpoint if you have one
      // (e.g. /api/v1/health).
      await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    const handleOnline = () => probe();
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // cleanup on unmount
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOnline);
    };
  }, [probe]);

  return {isOnline, checking, probe};
}

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "@/store/ui.store";
import { subscribeSSE } from "@/lib/sseBus";
import { bookingKeys } from "@/pages/bookings/hooks/useBookings";

// Mirrors the production useSSE contract from frontend.md: subscribes to
// booking/payment events and invalidates the relevant query keys. Connection
// lifecycle (open/error/reconnect) is simulated since there's no live backend
// in this build, but the cache-invalidation behaviour is identical.
export function useSSE() {
  const queryClient = useQueryClient();
  const setSseBannerVisible = useUiStore((s) => s.setSseBannerVisible);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    setSseBannerVisible(false);
    clearTimeout(bannerTimer.current);

    const unsubs = [
      subscribeSSE("booking.created", () => {
        queryClient.invalidateQueries({ queryKey: bookingKeys.all });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }),
      subscribeSSE("booking.approved", () => {
        queryClient.invalidateQueries({ queryKey: bookingKeys.all });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }),
      subscribeSSE("booking.cancelled", () => {
        queryClient.invalidateQueries({ queryKey: bookingKeys.all });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }),
      subscribeSSE("payment.completed", () => {
        queryClient.invalidateQueries({ queryKey: ["payments"] });
        queryClient.invalidateQueries({ queryKey: bookingKeys.all });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      clearTimeout(bannerTimer.current);
    };
  }, [queryClient, setSseBannerVisible]);
}

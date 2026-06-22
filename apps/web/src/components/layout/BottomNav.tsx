import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/navConfig";
import { usePendingCount } from "@/pages/bookings/hooks/useBookings";

export default function BottomNav() {
  const pendingCount = usePendingCount();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const showBadge = item.to === "/bookings" && pendingCount > 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-2xs ${
                isActive ? "text-primary" : "text-text-secondary"
              }`
            }
          >
            <span className="relative">
              <Icon className="h-5 w-5" aria-hidden="true" />
              {showBadge && (
                <span
                  className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white"
                  aria-label={`${pendingCount} pending approvals`}
                >
                  {pendingCount}
                </span>
              )}
            </span>
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

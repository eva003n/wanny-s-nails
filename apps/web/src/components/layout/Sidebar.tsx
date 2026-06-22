import { NavLink } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/navConfig";
import { usePendingCount } from "@/pages/bookings/hooks/useBookings";

export default function Sidebar() {
  const pendingCount = usePendingCount();

  return (
    <aside
      className="hidden flex-col border-r border-border bg-surface md:flex md:w-20 lg:w-60"
      aria-label="Primary"
    >
      <div className="flex h-16 items-center gap-2 px-4 lg:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius-md] bg-primary-light text-primary">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="hidden text-md font-bold text-text-primary lg:inline">Wanny's Nails</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const showBadge = item.to === "/bookings" && pendingCount > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-[--radius-md] px-3 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary-light text-primary-dark" : "text-text-secondary hover:bg-surface-raised"
                }`
              }
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {showBadge && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white"
                    aria-label={`${pendingCount} pending approvals`}
                  >
                    {pendingCount}
                  </span>
                )}
              </span>
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * §5.1 Bottom Tab Bar + §3.1 Layout Structure
 *
 * Mobile-first: fixed bottom tab bar, content centered.
 * Top-level layout wraps all protected routes.
 * §14 Iconography: Lucide React exclusively, 22px for navigation icons.
 */
import { NavLink, Outlet } from "react-router-dom";
import { LayoutGrid, Calendar, CreditCard, Users, Settings } from "lucide-react";
import { clsx } from "clsx";

/* ── §5.1 Tab definitions ── */
const tabs = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
  },
  {
    to: "/bookings",
    label: "Bookings",
    icon: Calendar,
  },
  {
    to: "/payments",
    label: "Payments",
    icon: CreditCard,
  },
  {
    to: "/customers",
    label: "Customers",
    icon: Users,
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-bg">
      {/* §3.1 Max content width centered + safe area page wrapper */}
      <main id="main-content" role="main" className="page mx-auto max-w-[480px]">
        <Outlet />
      </main>

      {/* §5.1 Bottom Tab Bar — height 64px */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-16 max-w-[480px] items-center justify-around">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive: _isActive }) =>
                clsx(
                  "flex flex-1 flex-col items-center justify-center gap-[2px] py-2 transition-colors",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className={clsx(
                      isActive ? "text-primary" : "text-text-disabled",
                    )}
                  />
                  <span
                    className={clsx(
                      "font-medium leading-none text-xs",
                      isActive ? "text-primary" : "text-text-disabled",
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
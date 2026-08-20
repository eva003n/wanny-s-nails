/**
 * §5.1 Bottom Tab Bar + §3.1 Layout Structure
 *
 * Mobile-first: fixed bottom tab bar, content centered.
 * Top-level layout wraps all protected routes.
 * §14 Iconography: Lucide React exclusively, 22px for navigation icons.
 */
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Calendar,
  CreditCard,
  Users,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";
import NotificationBell from "@/components/NotificationBell";
import OfflineBanner from "./OfflineBanner";

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

/** Page titles for the header bar — derived from route path (map pathname -> Page title) */
function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/bookings")) return "Bookings";
  if (pathname.startsWith("/payments")) return "Payments";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/settings")) return "Settings";
  return "";
}

export default function AppShell() {
  const location = useLocation();
  const showTopBar = !location.pathname.startsWith("/notifications");

  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar with notification bell — shown on all pages except /notifications */}
      {showTopBar && (
        <header className="sticky top-0 z-20 h-12 border-b border-border bg-bg">
          <div className="mx-auto flex h-full max-w-120 items-center justify-between px-4">
            <h1 className="text-lg font-bold text-text-primary">
              {getPageTitle(location.pathname)}
            </h1>

            <div className="flex gap-4">
              <OfflineBanner />
              <NotificationBell />
            </div>
          </div>
        </header>
      )}

      {/* §3.1 Max content width centered + safe area page wrapper */}
      <main id="main-content" role="main" className="page mx-auto max-w-120">
        <Outlet />
      </main>

      {/* §5.1 Bottom Tab Bar — height 64px */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-16 max-w-120 items-center justify-around">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors"
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

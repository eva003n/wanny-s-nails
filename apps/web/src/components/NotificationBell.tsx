/**
 * NotificationBell — top-right bell icon with unread count badge.
 * Taps navigate to /notifications.
 */
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUnreadCount } from "@/pages/notifications/hooks/useNotifications";

export default function NotificationBell() {
  const navigate = useNavigate();
  const { data: unreadData } = useUnreadCount();
  const unread = unreadData?.count ?? 0;

  return (
    <button
      onClick={() => navigate("/notifications")}
      className="relative flex min-h-11 min-w-11 items-center justify-center"
      aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
    >
      <Bell size={22} strokeWidth={2} className="text-text-primary" />
      {unread > 0 && (
        <span
          className="absolute right-0.5 top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-error px-1 text-2xs font-bold leading-none text-white"
          style={{ height: 18 }}
          aria-hidden="true"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
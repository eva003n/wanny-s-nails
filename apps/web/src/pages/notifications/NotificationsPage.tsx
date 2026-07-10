/**
 * NotificationsPage — full notification list page.
 *
 * Shows all notifications for the current user, newest first.
 * Tapping a notification marks it as read and navigates to the related entity.
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Calendar, CreditCard, MessageSquare } from "lucide-react";
import { useNotifications, useMarkAsRead } from "@/pages/notifications/hooks/useNotifications";
import { Skeleton } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { timeAgo } from "@/lib/format";
import type { Notification, NotificationType } from "@/lib/notification-schemas";

/* ── Type → icon + label mapping ── */

function getTypeIcon(type: NotificationType) {
  if (type.startsWith("BOOKING")) return Calendar;
  if (type.startsWith("PAYMENT")) return CreditCard;
  if (type.startsWith("FEEDBACK") || type === "REVIEW_REQUEST" || type === "REVIEW_RECEIPT" || type === "THANK_YOU") return MessageSquare;
  return Bell;
}

function getTypeLabel(type: NotificationType): string {
  switch (type) {
    case "BOOKING_CREATED": return "New Booking";
    case "BOOKING_PENDING_CONFIRMATION": return "Awaiting Confirmation";
    case "BOOKING_CONFIRMED": return "Booking Confirmed";
    case "BOOKING_REJECTED": return "Booking Rejected";
    case "BOOKING_CANCELLED": return "Booking Cancelled";
    case "BOOKING_RESCHEDULED": return "Booking Rescheduled";
    case "BOOKING_COMPLETED": return "Booking Completed";
    case "BOOKING_NO_SHOW": return "No Show";
    case "APPOINTMENT_REMINDER": return "Appointment Reminder";
    case "PAYMENT_REQUEST": return "Payment Request";
    case "PAYMENT_RECEIVED": return "Payment Received";
    case "PAYMENT_REFUNDED": return "Payment Refunded";
    case "PAYMENT_SUCCESS": return "Payment Successful";
    case "PAYMENT_FAILED": return "Payment Failed";
    case "PAYMENT_EXPIRED": return "Payment Expired";
    case "REVIEW_RECEIPT": return "Receipt";
    case "THANK_YOU": return "Thank You";
    case "FEEDBACK_REQUEST": return "We'd Love Your Feedback";
    case "REVIEW_REQUEST": return "Review Request";
    default: return "Notification";
  }
}

function getBodyPreview(notification: Notification): string {
  const p = notification.payload as Record<string, unknown> | undefined;
  if (!p) return "";

  // Try common payload shapes
  if (p.body && typeof p.body === "string") return p.body;
  if (p.message && typeof p.message === "string") return p.message;
  if (p.title && typeof p.title === "string" && p.title !== getTypeLabel(notification.type)) return p.title as string;

  // Fall back to showing the type
  return "";
}

/* ── Notification row ── */

function NotificationRow({
  notification,
  onTap,
}: {
  notification: Notification;
  onTap: (n: Notification) => void;
}) {
  const Icon = getTypeIcon(notification.type);
  const isUnread = !notification.readAt;
  const body = getBodyPreview(notification);

  return (
    <button
      onClick={() => onTap(notification)}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised active:bg-surface-raised"
    >
      {/* Icon */}
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
        <Icon size={18} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`text-sm ${isUnread ? "font-bold text-text-primary" : "font-medium text-text-primary"}`}
          >
            {getTypeLabel(notification.type)}
          </span>
          <span className="shrink-0 text-xs text-text-disabled">
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        {body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
            {body}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xs text-text-disabled">
            {notification.channel === "WHATSAPP" ? "WhatsApp" :
             notification.channel === "PUSH" ? "Push" : "Email"}
          </span>
          {notification.booking?.reference && (
            <span className="text-2xs text-text-disabled">
              #{notification.booking.reference}
            </span>
          )}
        </div>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}

/* ── Skeleton ── */

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page ── */

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useNotifications();
  const markAsRead = useMarkAsRead();

  const notifications = data?.data ?? [];

  const handleTap = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.readAt) {
      markAsRead.mutate(notification.id);
    }

    // Navigate to booking detail if we have a booking reference
    if (notification.booking?.id) {
      navigate(`/bookings/${notification.booking.id}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex min-h-11 min-w-11 items-center justify-center"
            aria-label="Go back"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <NotificationsSkeleton />
      ) : error ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Failed to load notifications"}
          onRetry={() => refetch()}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          heading="No notifications yet"
          description="You'll see updates about bookings and payments here."
        />
      ) : (
        <div className="divide-y divide-divider">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} onTap={handleTap} />
          ))}
        </div>
      )}
    </div>
  );
}
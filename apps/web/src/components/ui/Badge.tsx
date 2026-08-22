/**
 * §4.2 Status Badge Specification
 *
 * Pill-shaped. Background is always the *-bg tint of the status colour.
 * Text is the status colour. Never background = status colour (too harsh).
 * Always include aria-label — colour is not the only indicator.
 * Use Lucide React icons only, never emoji.
 */
import { clsx } from "clsx";
import {
  CheckCircle2,
  Clock,
  XCircle,
  BadgeCheck,
  CalendarOff,
} from "lucide-react";

type BadgeVariant = "success" | "warning" | "error" | "neutral" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  icon?: boolean;
  /** Shorthand: derive variant & label from a booking status */
  kind?: "booking";
  status?: string;
}

/* §4.2 exact token mappings */
const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: {
    bg: "bg-success-bg",
    text: "text-success",
  },
  warning: {
    bg: "bg-warning-bg",
    text: "text-warning",
  },
  error: {
    bg: "bg-error-bg",
    text: "text-error",
  },
  neutral: {
    bg: "bg-gray-100",
    text: "text-gray-400",
  },
  info: {
    bg: "bg-info-bg",
    text: "text-info",
  },
};

/**
 * Map raw booking status strings to badge variants for convenience.
 * Returns the variant and the human-readable label.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function bookingStatusToBadge(status: string): {
  variant: BadgeVariant;
  label: string;
} {
  switch (status) {
    case "PENDING":
      return { variant: "warning", label: "Pending" };
    case "APPROVED":
      return { variant: "info", label: "Confirmed" };
    case "PAYMENT_PENDING":
      return { variant: "warning", label: "Awaiting Payment" };
    case "PAYMENT_COMPLETED":
      return { variant: "success", label: "Paid" };
    case "CANCELLED":
    case "NO_SHOW":
      return { variant: "neutral", label: "No show" };
    case "COMPLETED":
      return { variant: "success", label: "Completed" };
    case "RESCHEDULED":
      return { variant: "info", label: "Rescheduled" };
    case "IN_PROGRESS":
      return { variant: "info", label: "In Progress" };
    default:
      return { variant: "warning", label: status };
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function paymentStatusToBadge(status: string): {
  variant: BadgeVariant;
  label: string;
} {
  switch (status) {
    case "PAID":
      return { variant: "success", label: "Paid" };
    case "PAYMENT_PENDING":
      return { variant: "warning", label: "Pending" };
    case "PAYMENT_FAILED":
      return { variant: "error", label: "Failed" };
    case "REFUNDED":
      return { variant: "info", label: "Refunded" };
    default:
      return { variant: "warning", label: status };
  }
}

const iconMap: Record<BadgeVariant, React.ComponentType<{ size?: number }>> = {
  success: BadgeCheck,
  warning: Clock,
  error: XCircle,
  neutral: CalendarOff,
  info: CheckCircle2,
};

export default function Badge({
  variant = "warning",
  children,
  className,
  ariaLabel,
  icon = true,
  kind,
  status,
}: BadgeProps) {
  /* When used as a shorthand booking-status badge */
  if (kind === "booking" && status) {
    const { variant: v, label } = bookingStatusToBadge(status);
    const styles = variantStyles[v];
    const Icon = iconMap[v];
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1",
          styles.bg,
          styles.text,
          "text-xs font-medium px-2 py-1 rounded-[--radius-sm]",
          className,
        )}
        aria-label={ariaLabel || `Status: ${label}`}
      >
        <Icon size={12} />
        {label}
      </span>
    );
  }

  const styles = variantStyles[variant];
  const Icon = iconMap[variant];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 ",
        styles.bg,
        styles.text,
        "text-xs font-medium px-2 py-1 rounded-[--radius-sm]",
        className,
      )}
      aria-label={ariaLabel || `Status: ${children}`}
    >
      {icon && <Icon size={12} />}
      {children}
    </span>
  );
}

/* 

import { BadgeCheck, CheckCircle, Clock, CreditCard, RefreshCw, Star, XCircle, type LucideIcon } from "lucide-react";
import type { BookingStatus, PaymentStatus } from "@/lib/schemas";

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  text: string;
  bg: string;
}

const bookingStatusConfig: Record<BookingStatus, StatusConfig> = {
  PENDING: { label: "Pending", icon: Clock, text: "text-warning", bg: "bg-warning-bg" },
  APPROVED: { label: "Confirmed", icon: CheckCircle, text: "text-info", bg: "bg-info-bg" },
  RESCHEDULED: { label: "Rescheduled", icon: RefreshCw, text: "text-info", bg: "bg-info-bg" },
  CANCELLED: { label: "Cancelled", icon: XCircle, text: "text-error", bg: "bg-error-bg" },
  COMPLETED: { label: "Completed", icon: Star, text: "text-success", bg: "bg-success-bg" },
  NO_SHOW: { label: "No-show", icon: XCircle, text: "text-error", bg: "bg-error-bg" },
};

const paymentStatusConfig: Record<PaymentStatus, StatusConfig> = {
  UNPAID: { label: "Awaiting Payment", icon: CreditCard, text: "text-warning", bg: "bg-warning-bg" },
  PAYMENT_PENDING: { label: "Awaiting Payment", icon: CreditCard, text: "text-warning", bg: "bg-warning-bg" },
  PAID: { label: "Paid", icon: BadgeCheck, text: "text-success", bg: "bg-success-bg" },
  PAYMENT_FAILED: { label: "Payment Failed", icon: XCircle, text: "text-error", bg: "bg-error-bg" },
  REFUNDED: { label: "Refunded", icon: RefreshCw, text: "text-text-secondary", bg: "bg-surface-raised" },
};

interface BadgeProps {
  kind: "booking" | "payment";
  status: BookingStatus | PaymentStatus;
  className?: string;
}

export default function Badge({ kind, status, className = "" }: BadgeProps) {
  const config =
    kind === "booking"
      ? bookingStatusConfig[status as BookingStatus]
      : paymentStatusConfig[status as PaymentStatus];

  if (!config) return null;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[--radius-sm] px-2 py-1 text-2xs font-medium ${config.bg} ${config.text} ${className}`}
      aria-label={`Status: ${config.label}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

*/
/**
 * §4.2 Booking Detail
 *
 * §5.2 Screen Header with back navigation.
 * Single-column card layout (no grids — §1.2 anti-pattern).
 * §8.1: KES amounts tabular-nums.
 * §6.3: Primary action button full width.
 */
import { useParams, useNavigate } from "react-router-dom";
import { useBookingDetail, useApproveBooking, useCancelBooking } from "./hooks/useBookings";
import { useUiStore } from "@/store/ui.store";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { bookingStatusToBadge, paymentStatusToBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";

/* §8.1 KES format */
function formatKES(amount: number): string {
  return `KES\u00A0${amount.toLocaleString("en-KE")}`;
}

/* §8.2 Full date: "Tuesday, 16 June 2026" */
function formatFullDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/* ── Skeleton ── */
function BookingDetailSkeleton() {
  return (
    <div>
      <PageHeader title="Booking" showBack />
      <div style={{ padding: "var(--space-16)" }}>
        <Card>
          <Skeleton shape="heading" width="40%" height="20px" />
          <div style={{ height: "var(--space-16)" }} />
          <Skeleton shape="text" width="100%" height="14px" />
          <div style={{ height: "var(--space-8)" }} />
          <Skeleton shape="text" width="80%" height="14px" />
          <div style={{ height: "var(--space-8)" }} />
          <Skeleton shape="text" width="60%" height="14px" />
        </Card>
      </div>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) throw new Error("Missing booking ID");

  const navigate = useNavigate();
  const { data: booking, isLoading, error, refetch } = useBookingDetail(id);
  const approveBooking = useApproveBooking();
  const cancelBooking = useCancelBooking();
  const showToast = useUiStore((s) => s.showToast);

  if (isLoading) return <BookingDetailSkeleton />;
  if (error)
    return (
      <div>
        <PageHeader title="Booking" showBack />
        <ErrorState
          heading="Couldn't load booking details"
          message="Check your connection and try again."
          onRetry={refetch}
        />
      </div>
    );
  if (!booking)
    return (
      <div>
        <PageHeader title="Booking" showBack />
        <ErrorState heading="Booking not found" message="This booking may have been removed." />
      </div>
    );

  const handleApprove = () => {
    approveBooking.mutate(booking.id, {
      onSuccess: () => showToast({ type: "success", message: "Booking confirmed." }),
      onError: () => showToast({ type: "error", message: "Failed to confirm booking." }),
    });
  };

  const handleCancel = () => {
    cancelBooking.mutate(booking.id, {
      onSuccess: () => showToast({ type: "success", message: "Booking cancelled." }),
      onError: () => showToast({ type: "error", message: "Failed to cancel booking." }),
    });
  };

  return (
    <div>
      <PageHeader title={`Booking ${booking.reference}`} showBack />

      <div style={{ padding: "var(--space-16)", display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
        {/* §4.2 Status + Time */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Badge variant={bookingStatusToBadge(booking.status).variant} ariaLabel={`Status: ${booking.status}`}>
            {bookingStatusToBadge(booking.status).label}
          </Badge>
          <span
            style={{
              fontSize: "13px",
              lineHeight: "18px",
              color: "var(--color-text-secondary)",
            }}
          >
            {formatFullDate(booking.appointmentAt)}
          </span>
        </div>

        {/* Client Card */}
        <Card>
          <p style={{ fontSize: "13px", lineHeight: "18px", letterSpacing: "0.6px", fontWeight: 500, textTransform: "uppercase", color: "var(--color-text-secondary)", marginBottom: "var(--space-12)" }}>
            Client
          </p>
          <p style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
            {booking.customer.name}
          </p>
          <p style={{ fontSize: "14px", lineHeight: "20px", color: "var(--color-text-secondary)", margin: "var(--space-4) 0 0" }}>
            {booking.customer.phone}
          </p>
        </Card>

        {/* Service Card */}
        <Card>
          <p style={{ fontSize: "13px", lineHeight: "18px", letterSpacing: "0.6px", fontWeight: 500, textTransform: "uppercase", color: "var(--color-text-secondary)", marginBottom: "var(--space-12)" }}>
            Service
          </p>
          <p style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
            {booking.service.name}
          </p>
          <p style={{ fontSize: "14px", lineHeight: "20px", color: "var(--color-text-secondary)", margin: "var(--space-4) 0 0" }}>
            {booking.durationMinutes} minutes
          </p>
        </Card>

        {/* Payment Card */}
        <Card>
          <p style={{ fontSize: "13px", lineHeight: "18px", letterSpacing: "0.6px", fontWeight: 500, textTransform: "uppercase", color: "var(--color-text-secondary)", marginBottom: "var(--space-12)" }}>
            Payment
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                fontSize: "20px",
                lineHeight: "24px",
                letterSpacing: "-0.2px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatKES(booking.priceKes)}
            </span>
            <Badge variant={paymentStatusToBadge(booking.paymentStatus).variant} ariaLabel={`Status: ${booking.paymentStatus}`}>
              {paymentStatusToBadge(booking.paymentStatus).label}
            </Badge>
          </div>
        </Card>

        {/* Notes */}
        {booking.notes && (
          <Card>
            <p style={{ fontSize: "13px", lineHeight: "18px", letterSpacing: "0.6px", fontWeight: 500, textTransform: "uppercase", color: "var(--color-text-secondary)", marginBottom: "var(--space-12)" }}>
              Notes
            </p>
            <p style={{ fontSize: "16px", lineHeight: "22px", color: "var(--color-text-primary)", margin: 0 }}>
              {booking.notes}
            </p>
          </Card>
        )}

        {/* §6.3 Action buttons */}
        {booking.status === "PENDING" && (
          <Button onClick={handleApprove} loading={approveBooking.isPending}>
            Confirm Booking
          </Button>
        )}
        {(booking.status === "PENDING" || booking.status === "APPROVED") && (
          <Button variant="destructive" onClick={handleCancel} loading={cancelBooking.isPending}>
            Cancel Booking
          </Button>
        )}
      </div>
    </div>
  );
}

/* 
new ui

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useApproveBooking,
  useBooking,
  useCancelBooking,
  useMarkBookingComplete,
  useMarkPaymentManually,
  useSendPaymentRequest,
} from "@/pages/bookings/hooks/useBookings";
import { useUiStore } from "@/store/ui.store";
import { formatDateShort, formatKes, formatPhoneForWhatsApp, formatTime } from "@/lib/format";

type DialogKind = "approve" | "cancel" | "complete" | "mark-paid" | null;

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) throw new Error("Missing booking ID");

  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const [activeDialog, setActiveDialog] = useState<DialogKind>(null);

  const { data: booking, isLoading, error, refetch } = useBooking(id);
  const approveMutation = useApproveBooking();
  const cancelMutation = useCancelBooking();
  const completeMutation = useMarkBookingComplete();
  const markPaidMutation = useMarkPaymentManually();
  const paymentRequestMutation = useSendPaymentRequest();

  if (isLoading || !booking) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Booking Detail" back />
        <div className="space-y-4 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Booking Detail" back />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const closeDialog = () => setActiveDialog(null);

  const handleApprove = () => {
    approveMutation.mutate(id, {
      onSuccess: (b) => {
        showToast("success", `Booking approved. ${b.customer.name} has been notified.`);
        closeDialog();
      },
      onError: () => {
        showToast("error", "Action failed — check your connection and try again");
        closeDialog();
      },
    });
  };

  const handleCancel = () => {
    cancelMutation.mutate(
      { bookingId: id },
      {
        onSuccess: (b) => {
          showToast("success", `Booking cancelled. ${b.customer.name} has been notified.`);
          closeDialog();
        },
        onError: () => {
          showToast("error", "Action failed — check your connection and try again");
          closeDialog();
        },
      },
    );
  };

  const handleComplete = () => {
    completeMutation.mutate(id, {
      onSuccess: () => {
        showToast("success", "Booking marked complete.");
        closeDialog();
      },
      onError: () => {
        showToast("error", "Action failed — check your connection and try again");
        closeDialog();
      },
    });
  };

  const handleMarkPaid = () => {
    markPaidMutation.mutate(id, {
      onSuccess: () => {
        showToast("success", "Payment recorded as paid in cash.");
        closeDialog();
      },
      onError: () => {
        showToast("error", "Action failed — check your connection and try again");
        closeDialog();
      },
    });
  };

  const handleSendPaymentRequest = () => {
    paymentRequestMutation.mutate(id, {
      onSuccess: () => showToast("success", "Payment request sent via M-Pesa."),
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Payment request failed. Retry from the booking detail.";
        showToast("error", message);
      },
    });
  };

  const isPaid = booking.paymentStatus === "PAID";
  const isReadOnly = booking.status === "COMPLETED" || booking.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Booking Detail" back />

      <div className="px-4 py-5">
        {booking.status === "CANCELLED" && (
          <div className="mb-4 rounded-[--radius-md] bg-error-bg px-4 py-3 text-sm font-medium text-error">
            This booking was cancelled.
          </div>
        )}

        <div className="flex items-center gap-3">
          <Avatar name={booking.customer.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-text-primary">{booking.customer.name}</p>
            <p className="truncate text-sm text-text-secondary">{booking.customer.phone}</p>
          </div>
          <a
            href={`https://wa.me/${formatPhoneForWhatsApp(booking.customer.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-1.5 rounded-[--radius-lg] bg-success-bg px-3 text-sm font-semibold text-success"
            aria-label={`Open WhatsApp chat with ${booking.customer.name}`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
        </div>

        <dl className="mt-5 divide-y divide-[--color-divider] rounded-[--radius-md] bg-surface shadow-[--shadow-card]">
          {[
            ["Service", booking.service.name],
            ["Date", formatDateShort(booking.appointmentAt)],
            ["Time", formatTime(booking.appointmentAt)],
            ["Duration", `${booking.durationMinutes} min`],
            ["Price", formatKes(booking.priceKes)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-text-secondary">{label}</dt>
              <dd className="text-base font-medium text-text-primary">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-text-secondary">Status</dt>
            <dd>
              <Badge kind="booking" status={booking.status} />
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-text-secondary">Payment</dt>
            <dd>
              <Badge kind="payment" status={booking.paymentStatus} />
            </dd>
          </div>
        </dl>

        {booking.notes && (
          <div className="mt-4 rounded-[--radius-md] bg-info-bg px-4 py-3 text-sm text-text-primary">
            <span className="font-semibold text-info">Note: </span>
            {booking.notes}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-text-secondary">REF: {booking.reference}</p>

        {!isReadOnly && (
          <div className="mt-6 flex flex-col gap-3">
            {booking.status === "PENDING" && (
              <Button onClick={() => setActiveDialog("approve")} fullWidth>
                Approve Booking
              </Button>
            )}
            {booking.status !== "PENDING" && !isPaid && (
              <Button onClick={handleSendPaymentRequest} isLoading={paymentRequestMutation.isPending} fullWidth>
                Send Payment Request
              </Button>
            )}
            {booking.status !== "PENDING" && !isPaid && (
              <Button variant="secondary" onClick={() => setActiveDialog("mark-paid")} fullWidth>
                Mark Paid (Cash)
              </Button>
            )}
            {booking.status === "APPROVED" && isPaid && (
              <Button onClick={() => setActiveDialog("complete")} fullWidth>
                Mark Complete
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`/bookings/${id}/reschedule`)} fullWidth>
              Reschedule
            </Button>
            <Button variant="destructive" onClick={() => setActiveDialog("cancel")} fullWidth>
              Cancel Booking
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={activeDialog === "approve"}
        title="Approve booking?"
        description={`Approve booking for ${booking.customer.name} at ${formatTime(booking.appointmentAt)}?`}
        confirmLabel="Approve"
        isConfirming={approveMutation.isPending}
        onConfirm={handleApprove}
        onCancel={closeDialog}
      />

      <Dialog
        open={activeDialog === "cancel"}
        title="Cancel this appointment?"
        description="The customer will be notified that their appointment was cancelled."
        confirmLabel="Cancel Appointment"
        cancelLabel="Keep"
        destructive
        isConfirming={cancelMutation.isPending}
        onConfirm={handleCancel}
        onCancel={closeDialog}
      />

      <Dialog
        open={activeDialog === "complete"}
        title="Mark booking complete?"
        description="This will move the booking to completed."
        confirmLabel="Mark Complete"
        isConfirming={completeMutation.isPending}
        onConfirm={handleComplete}
        onCancel={closeDialog}
      />

      <Dialog
        open={activeDialog === "mark-paid"}
        title="Mark as paid in cash?"
        description="Use this only if the customer paid in person, not via M-Pesa."
        confirmLabel="Mark Paid"
        isConfirming={markPaidMutation.isPending}
        onConfirm={handleMarkPaid}
        onCancel={closeDialog}
      />
    </div>
  );
}

*/
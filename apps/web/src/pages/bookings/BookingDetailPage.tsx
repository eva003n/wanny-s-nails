/**
 * §4.2 Booking Detail
 *
 * §5.2 Screen Header with back navigation.
 * Single-column card layout (no grids — §1.2 anti-pattern).
 * §8.1: KES amounts tabular-nums.
 * §6.3: Primary action button full width.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Avatar from "@/components/ui/Avatar";
import Badge, { bookingStatusToBadge, paymentStatusToBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";
import {
  useBookingDetail,
  useApproveBooking,
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

  const { data: booking, isLoading, error, refetch } = useBookingDetail(id);
  const approveMutation = useApproveBooking();
  const cancelMutation = useCancelBooking();
  const completeMutation = useMarkBookingComplete();
  const markPaidMutation = useMarkPaymentManually();
  const paymentRequestMutation = useSendPaymentRequest();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Booking Detail" showBack />
        <div className="space-y-4 p-4">
          <Skeleton shape="heading" width="100%" height="64px" />
          <Skeleton shape="text" width="100%" height="192px" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Booking Detail" showBack />
        <ErrorState
          heading="Couldn't load booking details"
          message="Check your connection and try again."
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Booking Detail" showBack />
        <ErrorState heading="Booking not found" message="This booking may have been removed." />
      </div>
    );
  }

  const closeDialog = () => setActiveDialog(null);

  const handleApprove = () => {
    approveMutation.mutate(booking.id, {
      onSuccess: () => {
        showToast("success", `Booking approved. ${booking.customer.name} has been notified.`);
        closeDialog();
      },
      onError: () => {
        showToast("error", "Action failed — check your connection and try again");
        closeDialog();
      },
    });
  };

  const handleCancel = () => {
    cancelMutation.mutate({ bookingId: booking.id }, {
      onSuccess: () => {
        showToast("success", `Booking cancelled. ${booking.customer.name} has been notified.`);
        closeDialog();
      },
      onError: () => {
        showToast("error", "Action failed — check your connection and try again");
        closeDialog();
      },
    });
  };

  const handleComplete = () => {
    completeMutation.mutate(booking.id, {
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
    markPaidMutation.mutate(booking.id, {
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
    paymentRequestMutation.mutate(
      { bookingId: booking.id, phoneNumber: booking.customer.phone },
      {
        onSuccess: () => showToast("success", "Payment request sent via M-Pesa."),
        onError: () => showToast("error", "Payment request failed. Retry from the booking detail."),
      },
    );
  };

  const isPaid = booking.paymentStatus === "PAID";
  const isReadOnly = booking.status === "COMPLETED" || booking.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Booking Detail" showBack />

      <div className="px-4 py-5">
        {booking.status === "CANCELLED" && (
          <div className="mb-4 rounded-[--radius-md] bg-error-bg px-4 py-3 text-sm font-medium text-error">
            This booking was cancelled.
          </div>
        )}

        {/* Customer Avatar + Name + WhatsApp link */}
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

        {/* Detail definition list */}
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
              <Badge variant={bookingStatusToBadge(booking.status).variant} ariaLabel={`Status: ${booking.status}`}>
                {bookingStatusToBadge(booking.status).label}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-text-secondary">Payment</dt>
            <dd>
              <Badge variant={paymentStatusToBadge(booking.paymentStatus).variant} ariaLabel={`Status: ${booking.paymentStatus}`}>
                {paymentStatusToBadge(booking.paymentStatus).label}
              </Badge>
            </dd>
          </div>
        </dl>

        {/* Notes */}
        {booking.notes && (
          <div className="mt-4 rounded-[--radius-md] bg-info-bg px-4 py-3 text-sm text-text-primary">
            <span className="font-semibold text-info">Note: </span>
            {booking.notes}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-text-secondary">REF: {booking.reference}</p>

        {/* Action buttons */}
        {!isReadOnly && (
          <div className="mt-6 flex flex-col gap-3">
            {booking.status === "PENDING" && (
              <Button onClick={() => setActiveDialog("approve")}>
                Approve Booking
              </Button>
            )}
            {booking.status !== "PENDING" && !isPaid && (
              <Button onClick={handleSendPaymentRequest} loading={paymentRequestMutation.isPending}>
                Send Payment Request
              </Button>
            )}
            {booking.status !== "PENDING" && !isPaid && (
              <Button variant="secondary" className="w-full" onClick={() => setActiveDialog("mark-paid")}>
                Mark Paid (Cash)
              </Button>
            )}
            {booking.status === "APPROVED" && isPaid && (
              <Button onClick={() => setActiveDialog("complete")}>
                Mark Complete
              </Button>
            )}
            <Button variant="secondary" className="w-full" onClick={() => navigate(`/bookings/${booking.id}/reschedule`)}>
              Reschedule
            </Button>
            <Button variant="destructive" onClick={() => setActiveDialog("cancel")}>
              Cancel Booking
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
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
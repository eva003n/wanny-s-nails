import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, RefreshCw, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import type { Booking } from "@/lib/schemas";
import { formatTime } from "@/lib/format";

interface BookingCardProps {
  booking: Booking;
  onApprove?: (id: string) => void;
  onReschedule?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export default function BookingCard({ booking, onApprove, onReschedule, onCancel }: BookingCardProps) {
  const navigate = useNavigate();
  const startX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const canApprove = booking.status === "PENDING" && onApprove;
  const canReschedule =
    (booking.status === "PENDING" || booking.status === "APPROVED") && onReschedule;
  const canCancel =
    (booking.status === "PENDING" || booking.status === "APPROVED") && onCancel;

  const hasActions = canApprove || canReschedule || canCancel;
  const actionWidth = [canApprove, canReschedule, canCancel].filter(Boolean).length * 64;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasActions) return;
    startX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || !hasActions) return;
    const delta = e.touches[0].clientX - startX.current;
    if (delta < 0) setSwipeOffset(Math.max(delta, -actionWidth));
  };
  const handleTouchEnd = () => {
    if (swipeOffset < -actionWidth / 2) {
      setSwipeOffset(-actionWidth);
    } else {
      setSwipeOffset(0);
    }
    startX.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-[--radius-md]">
      {hasActions && (
        <div className="absolute inset-y-0 right-0 flex">
          {canApprove && (
            <button
              onClick={() => {
                onApprove(booking.id);
                setSwipeOffset(0);
              }}
              className="flex w-16 flex-col items-center justify-center gap-1 bg-success text-white"
              aria-label={`Approve booking for ${booking.customer.name}`}
            >
              <Check className="h-5 w-5" aria-hidden="true" />
              <span className="text-2xs">Approve</span>
            </button>
          )}
          {canReschedule && (
            <button
              onClick={() => {
                onReschedule(booking.id);
                setSwipeOffset(0);
              }}
              className="flex w-16 flex-col items-center justify-center gap-1 bg-info text-white"
              aria-label={`Reschedule booking for ${booking.customer.name}`}
            >
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              <span className="text-2xs">Move</span>
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => {
                onCancel(booking.id);
                setSwipeOffset(0);
              }}
              className="flex w-16 flex-col items-center justify-center gap-1 bg-error text-white"
              aria-label={`Cancel booking for ${booking.customer.name}`}
            >
              <X className="h-5 w-5" aria-hidden="true" />
              <span className="text-2xs">Cancel</span>
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => {
          if (swipeOffset !== 0) {
            setSwipeOffset(0);
            return;
          }
          navigate(`/bookings/${booking.id}`);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        className="relative flex w-full items-center gap-3 bg-surface p-4 text-left shadow-[--shadow-card] transition-transform"
      >
        <Avatar name={booking.customer.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-md font-semibold text-text-primary">{booking.customer.name}</p>
          <p className="truncate text-sm text-text-secondary">{booking.service.name}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-base text-text-primary">{formatTime(booking.appointmentAt)}</span>
          <Badge kind="booking" status={booking.status} />
        </div>
      </button>
    </div>
  );
}

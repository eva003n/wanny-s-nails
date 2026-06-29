import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BottomSheet from "@/components/ui/BottomSheet";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import { useBooking, useRescheduleBooking } from "@/pages/bookings/hooks/useBookings";
import { useAvailableSlots } from "@/hooks/useServices";
import { useUiStore } from "@/store/ui.store";
import { formatTime } from "@/lib/format";

export default function RescheduleBookingPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) throw new Error("Missing booking ID");

  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);

  const { data: booking } = useBooking(id);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: slots, isLoading: slotsLoading } = useAvailableSlots(booking?.service.id, selectedDate);
  const slotsArray: { time: string; available: boolean; appointmentAt: string }[] = slots ?? [];
  const rescheduleMutation = useRescheduleBooking();

  const dateOptions = useMemo(() => {
    const days: { iso: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        iso: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-KE", { weekday: "short", day: "numeric" }),
      });
    }
    return days;
  }, []);

  const handleClose = () => navigate(`/bookings/${id}`);

  const handleConfirm = () => {
    if (!selectedSlot) return;
    rescheduleMutation.mutate(
      { bookingId: id, newStartAt: selectedSlot },
      {
        onSuccess: () => {
          showToast({type: "success", message: `Rescheduled to ${formatTime(selectedSlot)}.`});
          handleClose();
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "This slot was just taken — please choose another";
          showToast({type: "error", message});
          setConfirmOpen(false);
        },
      },
    );
  };

  return (
    <>
      <BottomSheet open title="Reschedule" onClose={handleClose}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map((d) => (
              <button
                key={d.iso}
                onClick={() => {
                  setSelectedDate(d.iso);
                  setSelectedSlot(null);
                }}
                className={`min-h-11 shrink-0 rounded-[--radius-md] px-4 text-sm font-medium ${
                  selectedDate === d.iso ? "bg-primary text-white" : "bg-surface-raised text-text-primary"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {slotsLoading ? (
            <p className="text-sm text-text-secondary">Loading slots…</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slotsArray.map((slot) => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.appointmentAt)}
                  className={`min-h-11 rounded-[--radius-md] text-sm font-medium disabled:opacity-40 ${
                    selectedSlot === slot.appointmentAt
                      ? "bg-primary text-white"
                      : "bg-surface-raised text-text-primary"
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}

          <Button  disabled={!selectedSlot} onClick={() => setConfirmOpen(true)}>
            Confirm Reschedule
          </Button>
        </div>
      </BottomSheet>

      <Dialog
        open={confirmOpen}
        title="Confirm reschedule?"
        description={selectedSlot ? `Reschedule to ${formatTime(selectedSlot)}?` : undefined}
        confirmLabel="Confirm"
        isConfirming={rescheduleMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

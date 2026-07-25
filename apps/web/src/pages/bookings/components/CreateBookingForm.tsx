import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Avatar from "@/components/ui/Avatar";
import { useCustomers } from "@/pages/customers/hooks/useCustomers";
import { useAvailableSlots, useServices } from "@/hooks/useServices";
import { useCreateBooking } from "@/pages/bookings/hooks/useBookings";
import { useUiStore } from "@/store/ui.store";
import { formatKes, formatTime } from "@/lib/format";
import type { Customer } from "@/lib/schemas";
import { useAuthStore } from "@/store/auth.store";

interface CreateBookingFormProps {
  onSuccess: () => void;
  onRequestClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

export default function CreateBookingForm({ onSuccess, onRequestClose }: CreateBookingFormProps) {
  const showToast = useUiStore((s) => s.showToast);
  const {user} = useAuthStore()
  const [step, setStep] = useState<Step>(1);

  // Step 1 — customer
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const { data: customerResults } = useCustomers(customerQuery, 1, 10, !!customerQuery);

  // Step 2 — service (multi-select)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const { data: services, isLoading: servicesLoading } = useServices();

  /*______ Caching and performance optimization _______ */
  const selectedServices = useMemo(
    () => (services ?? []).filter((s) => selectedServiceIds.includes(s.id)),
    [services, selectedServiceIds],
  );

  // Compute total duration & price from selected services
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0),
    [selectedServices],
  );
  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.priceKes, 0),
    [selectedServices],
  );

  // Step 3 — date/time
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const { data: slots, isLoading: slotsLoading } = useAvailableSlots(
      selectedServiceIds,
      selectedDate,
    );

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

  const createMutation = useCreateBooking();

  const customerName = newCustomerMode ? newName : selectedCustomer?.name ?? "";
  const canGoStep2 = newCustomerMode ? newName.trim().length > 1 && newPhone.trim().length >= 9 : !!selectedCustomer;

  const handleConfirm = () => {
    if (selectedServiceIds.length === 0 || !selectedSlot) return;
    createMutation.mutate(
      {
        customerId: newCustomerMode ? undefined : selectedCustomer?.id,
        newCustomer: newCustomerMode ? { name: newName.trim(), phone: newPhone.trim() } : undefined,
        serviceIds: selectedServiceIds,
        appointmentAt: selectedSlot,
        stylist: user?.id
      },
      {
        onSuccess: (booking) => {
          showToast({ type: "success", message: `Booking created! ${booking.reference}` });
          onSuccess();
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Couldn't create the booking. Please try again.";
          showToast({ type: "error", message });
        },
      },
    );
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const servicesList = services ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div
        className="flex items-center gap-1.5"
        aria-label={`Step ${step} of 4`}
      >
        {[1, 2, 3, 4].map((s) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-divider"}`}
            aria-hidden="true"
          />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-md font-semibold text-text-primary">
            Who's this for?
          </h3>
          {!newCustomerMode ? (
            <>
              <Input
                label="Customer"
                placeholder="Search by name..."
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setSelectedCustomer(null);
                }}
              />
              {customerQuery && (
                <div className="max-h-48 overflow-y-auto rounded-[--radius-md] border border-border">
                  {(customerResults?.data ?? []).length === 0 ? (
                    <p className="px-3 py-3 text-sm text-text-secondary">
                      No matches found.
                    </p>
                  ) : (
                    customerResults?.data.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerQuery(c.name);
                        }}
                        className={`flex w-full min-h-11 items-center gap-3 px-3 text-left ${
                          selectedCustomer?.id === c.id
                            ? "bg-primary-light"
                            : ""
                        }`}
                      >
                        <Avatar name={c.name} size="sm" />
                        <span className="text-sm text-text-primary">
                          {c.name}
                        </span>
                        <span className="ml-auto text-xs text-text-secondary">
                          {c.phone}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
              <button
                onClick={() => setNewCustomerMode(true)}
                className="min-h-11 self-start text-sm font-semibold text-primary"
              >
                + New customer
              </button>
            </>
          ) : (
            <>
              <Input
                label="Full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                label="Phone number"
                type="tel"
                placeholder="+254 7XX XXX XXX"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <button
                onClick={() => setNewCustomerMode(false)}
                className="min-h-11 self-start text-sm font-semibold text-primary"
              >
                ← Search existing customer
              </button>
            </>
          )}
          <Button fullWidth disabled={!canGoStep2} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-md font-semibold text-text-primary">
            Choose services
          </h3>
          {servicesLoading ? (
            <p className="text-sm text-text-secondary">Loading services…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {servicesList.map((s) => {
                const isSelected = selectedServiceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleService(s.id)}
                    className={`flex min-h-11 items-center justify-between rounded-[--radius-md] border px-3 py-3 text-left ${
                      isSelected
                        ? "border-primary bg-primary-light"
                        : "border-border"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-text-primary">
                        {s.name}
                      </span>
                      <span className="block text-xs text-text-secondary">
                        {s.durationMinutes} min
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {formatKes(s.priceKes)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {selectedServiceIds.length > 0 && (
            <p className="text-xs text-text-secondary">
              {selectedServices.length} service
              {selectedServices.length > 1 ? "s" : ""} selected ·{" "}
              {totalDuration} min total · {formatKes(totalPrice)}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              fullWidth
              disabled={selectedServiceIds.length === 0}
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-md font-semibold text-text-primary">
            Pick date & time
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map((d) => (
              <button
                key={d.iso}
                onClick={() => {
                  setSelectedDate(d.iso);
                  setSelectedSlot(null);
                }}
                className={`min-h-11 shrink-0 rounded-[--radius-md] px-4 text-sm font-medium ${
                  selectedDate === d.iso
                    ? "bg-primary text-white"
                    : "bg-surface-raised text-text-primary"
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
              {(slots ?? []).map((slot) => (
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
                  {formatTime(slot.appointmentAt)}
                </button>
              ))}
              {!slotsLoading && (slots ?? []).length === 0 && (
                <p className="col-span-3 text-sm text-text-secondary">
                  No slots available this day.
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              fullWidth
              disabled={!selectedSlot}
              onClick={() => setStep(4)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 4 && selectedServices.length > 0 && selectedSlot && (
        <div className="flex flex-col gap-4">
          <h3 className="text-md font-semibold text-text-primary">
            Review & confirm
          </h3>
          <div className="rounded-[--radius-md] bg-surface-raised p-4">
            <div className="flex items-center gap-3">
              <Avatar name={customerName} />
              <span className="text-sm font-semibold text-text-primary">
                {customerName}
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Services</dt>
                <dd className="font-medium text-text-primary text-right">
                  {selectedServices.map((s) => (
                    <div key={s.id}>{s.name}</div>
                  ))}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Time</dt>
                <dd className="font-medium text-text-primary">
                  {formatTime(selectedSlot)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Duration</dt>
                <dd className="font-medium text-text-primary">
                  {totalDuration} min
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Total</dt>
                <dd className="font-medium text-text-primary">
                  {formatKes(totalPrice)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              fullWidth
              onClick={handleConfirm}
              loading={createMutation.isPending}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Confirm Booking
            </Button>
          </div>
        </div>
      )}

      <button onClick={onRequestClose} className="sr-only">
        Close
      </button>
    </div>
  );
}
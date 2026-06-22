/**
 * §4.2 Bookings Page
 *
 * Single-column card list (no tables — §1.2 anti-pattern).
 * §7.2: Empty state with icon + CTA.
 * §7.1: Skeleton loading (not text "Loading...").
 * §8.1: KES amounts tabular-nums.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBookings } from "./hooks/useBookings";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { bookingStatusToBadge, paymentStatusToBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";

/* §8.1 KES format */
function formatKES(amount: number): string {
  return `KES\u00A0${amount.toLocaleString("en-KE")}`;
}

/* §8.2 Date: "Tue, 16 Jun · 9:00 AM" */
function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }) + " · " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_FILTERS = ["", "PENDING", "APPROVED", "CANCELLED", "COMPLETED"] as const;

export default function BookingsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const { data: bookings = [], isLoading, error, refetch } = useBookings({ status: filter || undefined });

  if (error) return <ErrorState message="Couldn't load your bookings." onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Bookings"
        showBack={false}
        action={
          <Button variant="secondary" onClick={() => navigate("/bookings/new")}>
            + New
          </Button>
        }
      />

      <div style={{ padding: "var(--space-16)" }}>
        {/* §4.2 Filter tabs */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-8)",
            overflowX: "auto",
            marginBottom: "var(--space-16)",
            scrollbarWidth: "none",
          }}
        >
          {STATUS_FILTERS.map((status) => (
            <button
              key={status || "all"}
              onClick={() => setFilter(status)}
              style={{
                flexShrink: 0,
                height: 36,
                padding: "0 var(--space-16)",
                borderRadius: "var(--radius-full)",
                   border: `1.5px solid ${filter === status ? "var(--color-primary)" : "var(--color-border)"}`,
                background: filter === status ? "var(--color-primary)" : "var(--color-surface)",
                color: filter === status ? "var(--color-text-inverse)" : "var(--color-text-primary)",
                fontSize: "13px",
                lineHeight: "18px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all var(--duration-fast) var(--ease-out)",
              }}
            >
              {status || "All"}
            </button>
          ))}
        </div>

        {/* §7.1 Loading skeleton */}
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton shape="text" width="30%" height="16px" />
                <div style={{ height: "var(--space-8)" }} />
                <Skeleton shape="text" width="50%" height="14px" />
                <div style={{ height: "var(--space-4)" }} />
                <Skeleton shape="text" width="40%" height="13px" />
              </Card>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          /* §7.2 Empty state */
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="8" width="36" height="36" rx="4" />
                <line x1="6" y1="20" x2="42" y2="20" />
                <line x1="16" y1="4" x2="16" y2="12" />
                <line x1="32" y1="4" x2="32" y2="12" />
              </svg>
            }
            heading="No bookings yet"
            body="Your schedule is clear. Book a client to get started."
            action={<Button onClick={() => navigate("/bookings/new")}>Book Appointment</Button>}
          />
        ) : (
          /* §4.2 Single-column card list */
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
            {bookings.map((booking) => (
              <Card
                key={booking.id}
                onClick={() => navigate(`/bookings/${booking.id}`)}
              >
                {/* Time + Status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-8)" }}>
                  <span
                    style={{
                      fontSize: "16px",
                      lineHeight: "22px",
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {formatDateTime(booking.appointmentAt)}
                  </span>
                  <Badge variant={bookingStatusToBadge(booking.status).variant} ariaLabel={`Status: ${booking.status}`}>
                    {bookingStatusToBadge(booking.status).label}
                  </Badge>
                </div>

                {/* Client + Service */}
                <p style={{ fontSize: "16px", lineHeight: "22px", color: "var(--color-text-primary)", margin: 0 }}>
                  {booking.customer.name}
                </p>
                <p style={{ fontSize: "13px", lineHeight: "18px", color: "var(--color-text-tertiary)", margin: "var(--space-2) 0 0" }}>
                  {booking.service.name}
                </p>

                {/* Amount + Payment status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-12)", paddingTop: "var(--space-12)", borderTop: "1px solid var(--color-border)" }}>
                  <span
                    style={{
                      fontSize: "16px",
                      lineHeight: "22px",
                      fontWeight: 500,
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* 
new ui

import { useMemo, useState } from "react";
import { useNavigate, useOutlet } from "react-router-dom";
import { Calendar, Plus, Search } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import BookingCard from "@/components/ui/BookingCard";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { BookingCardSkeleton } from "@/components/ui/Skeleton";
import { useApproveBooking, useBookings, useCancelBooking } from "@/pages/bookings/hooks/useBookings";
import { useUiStore } from "@/store/ui.store";
import { formatDayHeader } from "@/lib/format";
import type { Booking } from "@/lib/schemas";

type Tab = "today" | "upcoming" | "all";

function groupByDay(bookings: Booking[]): Array<[string, Booking[]]> {
  const groups = new Map<string, Booking[]>();
  for (const booking of bookings) {
    const key = formatDayHeader(booking.appointmentAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(booking);
  }
  return Array.from(groups.entries());
}

export default function BookingsListPage() {
  const navigate = useNavigate();
  const outlet = useOutlet(); // renders /bookings/new, /bookings/:id etc. as overlays
  const showToast = useUiStore((s) => s.showToast);

  const [tab, setTab] = useState<Tab>("today");
  const [search, setSearch] = useState("");

  const { data: bookings, isLoading, error, refetch } = useBookings({ tab, search: search || undefined });
  const approveMutation = useApproveBooking();
  const cancelMutation = useCancelBooking();

  const grouped = useMemo(() => groupByDay(bookings ?? []), [bookings]);

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: (b) => showToast("success", `Booking approved. ${b.customer.name} has been notified.`),
      onError: () => showToast("error", "Action failed — check your connection and try again"),
    });
  };

  const handleCancel = (id: string) => {
    cancelMutation.mutate(
      { bookingId: id },
      {
        onSuccess: (b) => showToast("success", `Booking cancelled. ${b.customer.name} has been notified.`),
        onError: () => showToast("error", "Action failed — check your connection and try again"),
      },
    );
  };

  const handleReschedule = (id: string) => navigate(`/bookings/${id}/reschedule`);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Bookings"
        action={
          <button
            onClick={() => navigate("/bookings/new")}
            className="flex min-h-11 items-center gap-1.5 rounded-[--radius-lg] bg-primary px-3 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-4 py-4">
        <SegmentedControl
          aria-label="Filter bookings"
          value={tab}
          onChange={setTab}
          options={[
            { value: "today", label: "Today" },
            { value: "upcoming", label: "Upcoming" },
            { value: "all", label: "All" },
          ]}
        />

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or service..."
            aria-label="Search bookings by name or service"
            className="min-h-11 w-full rounded-[--radius-md] border border-border bg-surface-raised pl-9 pr-3 text-base text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-6">
        {error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="flex flex-col gap-2">
            <BookingCardSkeleton />
            <BookingCardSkeleton />
            <BookingCardSkeleton />
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={Calendar}
            heading="No bookings found"
            description="Customers book via WhatsApp."
            action={
              <button
                onClick={() => navigate("/bookings/new")}
                className="mt-2 min-h-11 rounded-[--radius-lg] bg-primary px-5 text-sm font-semibold text-white"
              >
                + New Booking
              </button>
            }
          />
        ) : (
          grouped.map(([day, dayBookings]) => (
            <section key={day}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-text-secondary">{day}</h2>
              <div className="flex flex-col gap-2">
                {dayBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onApprove={booking.status === "PENDING" ? handleApprove : undefined}
                    onReschedule={handleReschedule}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {outlet}
    </div>
  );
}

*/
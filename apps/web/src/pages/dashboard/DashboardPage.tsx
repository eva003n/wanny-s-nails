/**
 * §4.1 Home — The 4-Question Dashboard
 *
 * 1. What needs my attention right now? → Action Center
 * 2. Who am I seeing today? → Schedule Ribbon
 * 3. How is money moving? → Financial Pulse
 * 4. Who is trying to reach me? → Communications
 *
 * §8.1 Currency: KES prefix, comma-separated, tabular-nums
 * §8.2 Timestamps: 12-hour format, no leading zero
 */
import { CalendarX, Clock, CreditCard, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/ui/StatCard";
import BookingCard from "@/components/ui/BookingCard";
import {
  StatCardSkeleton,
  BookingCardSkeleton,
} from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useDashboardStats } from "@/pages/dashboard/hooks/useDashboard";
import {
  useBookings,
  useApproveBooking,
  useCancelBooking,
} from "@/pages/bookings/hooks/useBookings";
import { useUiStore } from "@/store/ui.store";
import { formatKes, formatDate } from "@/lib/format";
import type { Booking } from "@/lib/schemas";
import { useAuthStore } from "@/store/auth.store";

function getTodaysBookings(tb: unknown): Booking[] {
  if (Array.isArray(tb)) return tb;
  if (tb && typeof tb === "object" && "data" in tb) return (tb as any).data;
  return [];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const showToast = useUiStore((s) => s.showToast);

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useDashboardStats();
  const {
    data: todayBookings,
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useBookings({
    tab: "today",
  });

  const approveMutation = useApproveBooking();
  const cancelMutation = useCancelBooking();

  const todaysBookings = getTodaysBookings(todayBookings);

  const upcoming = todaysBookings.filter(
    (b) => b.status === "APPROVED" || b.status === "RESCHEDULED",
  );
  const pending = todaysBookings.filter((b) => b.status === "PENDING");

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: (booking) =>
        showToast({
         type:  "success",
          message:`Booking approved. ${booking.customer.name} has been notified.`,
    }),
      onError: () =>
        showToast({
          type:"error",
          message: "Action failed — check your connection and try again",
    }),
    });
  };

  const handleCancel = (id: string) => {
    cancelMutation.mutate(
      { bookingId: id },
      {
        onSuccess: (booking) =>
          showToast({
            type:"success",
           message: `Booking cancelled. ${booking.customer.name} has been notified.`,
      }),
        onError: () =>
          showToast({
            type: "error",
            message: "Action failed — check your connection and try again",
      }),
      },
    );
  };

  if (statsError || bookingsError) {
    return (
      <ErrorState
        onRetry={() => {
          refetchStats();
          refetchBookings();
        }}
        message= {(statsError?.message as string || bookingsError?.message as string)}
      />
    );
  }

  const greetingName = user?.name || "there";
  const todayLabel = formatDate(new Date().toISOString());
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="text-2xl font-bold text-text-primary">
        {greeting}, {greetingName} 👋
      </h1>
      <p className="mt-1 text-base text-text-secondary">{todayLabel}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {statsLoading || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={Clock}
              value={String(stats.todayBookingsCount)}
              label="Today's Bookings"
              onClick={() => navigate("/bookings")}
            />
            <StatCard
              icon={CalendarX}
              value={String(stats.pendingCount)}
              label="Pending approvals"
              tone={stats.pendingCount > 0 ? "warning" : "default"}
              onClick={() => navigate("/bookings")}
            />
            <StatCard
              icon={DollarSign}
              value={formatKes(stats.todayRevenueKes)}
              label="Revenue Today"
            />
            <StatCard
              icon={CreditCard}
              value={formatKes(stats.unpaidKes)}
              label="Unpaid payments"
              tone={stats.unpaidKes > 0 ? "warning" : "default"}
              onClick={() => navigate("/payments")}
            />
          </>
        )}
      </div>

      <section className="mt-7">
        <h2 className="text-xl font-bold text-text-primary">Upcoming Today</h2>
        <div className="mt-3 flex flex-col gap-2">
          {bookingsLoading ? (
            <>
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </>
          ) : upcoming.length === 0 ? (
            <EmptyState icon={CalendarX} heading="No appointments today" />
          ) : (
            <>
              {upcoming.slice(0, 4).map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onCancel={handleCancel}
                />
              ))}
              {upcoming.length > 4 && (
                <button
                  onClick={() => navigate("/bookings")}
                  className="min-h-11 self-start text-sm font-semibold text-primary"
                >
                  See all →
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {pending.length > 0 && (
        <section className="mt-7">
          <h2 className="text-xl font-bold text-text-primary">
            Pending Approvals ({pending.length})
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {pending.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onApprove={handleApprove}
                onCancel={handleCancel}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


/*
new ui
 
import { CalendarX, Clock, CreditCard, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/ui/StatCard";
import BookingCard from "@/components/ui/BookingCard";
import { StatCardSkeleton, BookingCardSkeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useDashboardStats } from "@/pages/dashboard/hooks/useDashboard";
import { useBookings, useApproveBooking, useCancelBooking } from "@/pages/bookings/hooks/useBookings";
import { useUiStore } from "@/store/ui.store";
import { formatKes, formatDate } from "@/lib/format";

export default function DashboardPage() {
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: todayBookings, isLoading: bookingsLoading, error: bookingsError, refetch: refetchBookings } = useBookings({
    tab: "today",
  });

  const approveMutation = useApproveBooking();
  const cancelMutation = useCancelBooking();

  const upcoming = (todayBookings ?? []).filter(
    (b) => b.status === "APPROVED" || b.status === "RESCHEDULED",
  );
  const pending = (todayBookings ?? []).filter((b) => b.status === "PENDING");

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: (booking) =>
        showToast("success", `Booking approved. ${booking.customer.name} has been notified.`),
      onError: () => showToast("error", "Action failed — check your connection and try again"),
    });
  };

  const handleCancel = (id: string) => {
    cancelMutation.mutate(
      { bookingId: id },
      {
        onSuccess: (booking) =>
          showToast("success", `Booking cancelled. ${booking.customer.name} has been notified.`),
        onError: () => showToast("error", "Action failed — check your connection and try again"),
      },
    );
  };

  if (statsError || bookingsError) {
    return <ErrorState onRetry={() => { refetchStats(); refetchBookings(); }} />;
  }

  const greetingName = "Grace";
  const todayLabel = formatDate(new Date().toISOString());

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <h1 className="text-2xl font-bold text-text-primary">Good morning, {greetingName} 👋</h1>
      <p className="mt-1 text-base text-text-secondary">{todayLabel}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {statsLoading || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon={Clock}
              value={String(stats.todayBookingsCount)}
              label="Today's Bookings"
              onClick={() => navigate("/bookings")}
            />
            <StatCard
              icon={CalendarX}
              value={String(stats.pendingCount)}
              label="Pending"
              tone={stats.pendingCount > 0 ? "warning" : "default"}
              onClick={() => navigate("/bookings")}
            />
            <StatCard icon={DollarSign} value={formatKes(stats.todayRevenueKes)} label="Revenue Today" />
            <StatCard
              icon={CreditCard}
              value={formatKes(stats.unpaidKes)}
              label="Unpaid"
              tone={stats.unpaidKes > 0 ? "warning" : "default"}
              onClick={() => navigate("/payments")}
            />
          </>
        )}
      </div>

      <section className="mt-7">
        <h2 className="text-xl font-bold text-text-primary">Upcoming Today</h2>
        <div className="mt-3 flex flex-col gap-2">
          {bookingsLoading ? (
            <>
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </>
          ) : upcoming.length === 0 ? (
            <EmptyState icon={CalendarX} heading="No appointments today" />
          ) : (
            <>
              {upcoming.slice(0, 4).map((booking) => (
                <BookingCard key={booking.id} booking={booking} onCancel={handleCancel} />
              ))}
              {upcoming.length > 4 && (
                <button
                  onClick={() => navigate("/bookings")}
                  className="min-h-11 self-start text-sm font-semibold text-primary"
                >
                  See all →
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {pending.length > 0 && (
        <section className="mt-7">
          <h2 className="text-xl font-bold text-text-primary">Pending Approvals ({pending.length})</h2>
          <div className="mt-3 flex flex-col gap-2">
            {pending.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onApprove={handleApprove}
                onCancel={handleCancel}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

*/
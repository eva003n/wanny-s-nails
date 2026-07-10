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
import { useBookings, useDeleteBooking } from "./hooks/useBookings";
import { CalendarDays, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { bookingStatusToBadge, paymentStatusToBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Pagination from "@/components/ui/Pagination";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";

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

const STATUS_FILTERS = ["", "PENDING", "APPROVED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;

export default function BookingsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { data: result, isLoading, error, refetch } = useBookings({
    status: filter || undefined,
    page,
    limit,
  });
  const deleteMutation = useDeleteBooking();
  const user = useAuthStore((s) => s.user);
  const showToast = useUiStore((s) => s.showToast);
  const isOwner = user?.role === "OWNER";

  const bookings = result?.data ?? [];
  const meta = result?.meta;

  if (error) return <ErrorState message="Couldn't load your bookings." onRetry={refetch} />;

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        showToast({ type: "success", message: "Booking deleted." });
        setDeleteTarget(null);
      },
      onError: () => {
        showToast({ type: "error", message: "Failed to delete booking. It may have a paid or refunded payment." });
        setDeleteTarget(null);
      },
    });
  };

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
        ) : bookings.length === 0 && (!meta || meta.total === 0) ? (
          /* §7.2 Empty state */
          <EmptyState
            icon={CalendarDays}
            heading="No bookings yet"
            description="Your schedule is clear. Book a client to get started."
            action={<Button onClick={() => navigate("/bookings/new")}>Book Appointment</Button>}
          />
        ) : (
          <>
            {/* §4.2 Single-column card list */}
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

                  {/* Amount + Payment status + Delete */}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                      <Badge variant={paymentStatusToBadge(booking.paymentStatus).variant} ariaLabel={`Status: ${booking.paymentStatus}`}>
                        {paymentStatusToBadge(booking.paymentStatus).label}
                      </Badge>
                      {isOwner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: booking.id, name: booking.customer.name });
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 4,
                            cursor: "pointer",
                            color: "var(--color-text-tertiary)",
                            borderRadius: "var(--radius-sm)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "color var(--duration-fast) var(--ease-out)",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-error)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-tertiary)")}
                          aria-label={`Delete booking for ${booking.customer.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {meta && meta.totalPages > 1 && (
              <div className="px-4 py-3">
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                  limit={meta.limit}
                  onLimitChange={(l) => {
                    setLimit(l);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        title="Delete this booking?"
        description={
          deleteTarget
            ? `Permanently delete the booking for ${deleteTarget.name}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        isConfirming={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

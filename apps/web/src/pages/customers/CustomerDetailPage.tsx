import { useParams } from "react-router-dom";
import { MessageCircle, Calendar } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Avatar from "@/components/ui/Avatar";
import Badge, { bookingStatusToBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton, { ListRowSkeleton } from "@/components/ui/Skeleton";
import { useCustomer, useCustomerBookings } from "@/pages/customers/hooks/useCustomers";
import { formatDateShort, formatKes, formatPhoneForWhatsApp, formatTime } from "@/lib/format";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) throw new Error("Missing customer ID");

  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: bookings, isLoading: bookingsLoading } = useCustomerBookings(id);

  if (isLoading || !customer) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Customer" />
        <div className="space-y-4 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Customer" />
        <ErrorState message="Failed to load customer details." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Customer" />

      <div className="px-4 py-5">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-text-primary">{customer.name}</p>
            <p className="truncate text-sm text-text-secondary">{customer.phone}</p>
          </div>
          <a
            href={`https://wa.me/${formatPhoneForWhatsApp(customer.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-1.5 rounded-[--radius-lg] bg-success-bg px-3 text-sm font-semibold text-success"
            aria-label={`Open WhatsApp chat with ${customer.name}`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[--radius-md] bg-surface p-4 shadow-[--shadow-card]">
            <p className="text-2xl font-bold text-text-primary">{customer.totalBookings ?? 0}</p>
            <p className="text-sm text-text-secondary">Total Bookings</p>
          </div>
          <div className="rounded-[--radius-md] bg-surface p-4 shadow-[--shadow-card]">
            <p className="text-2xl font-bold text-text-primary">{formatKes(customer.totalSpentKes ?? 0)}</p>
            <p className="text-sm text-text-secondary">Total Spent</p>
          </div>
        </div>

        <section className="mt-7">
          <h2 className="text-md font-semibold text-text-primary">Booking History</h2>
          <div className="mt-3 divide-y divide-[--color-divider] rounded-[--radius-md] bg-surface shadow-[--shadow-card]">
            {bookingsLoading ? (
              <>
                <ListRowSkeleton />
                <ListRowSkeleton />
              </>
            ) : (bookings ?? []).length === 0 ? (
              <EmptyState icon={Calendar} heading="No bookings yet" />
            ) : (
              bookings!.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{b.service.name}</p>
                    <p className="text-xs text-text-secondary">
                      {formatDateShort(b.appointmentAt)} · {formatTime(b.appointmentAt)}
                    </p>
                  </div>
                  <Badge variant={bookingStatusToBadge(b.status).variant}>
                    {bookingStatusToBadge(b.status).label}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
/**
 * §8.3 Customers Page
 *
 * Single-column card list (no tables — §1.2 anti-pattern).
 * §6.1: Search input with label above.
 * §7.2: Empty state with icon + CTA.
 * §7.1: Skeleton loading.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { ListRowSkeleton } from "@/components/ui/Skeleton";
import { useCustomers } from "@/pages/customers/hooks/useCustomers";
import { formatKes, timeAgo } from "@/lib/format";

export default function CustomersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: customers, isLoading, error, refetch } = useCustomers(search || undefined);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Customers" />

      <div className="px-4 py-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            aria-label="Search customers by name or phone"
            className="min-h-11 w-full rounded-[--radius-md] border border-border bg-surface-raised pl-9 pr-3 text-base text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {error ? (
        <ErrorState message="Couldn't load your clients." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="divide-y divide-[--color-divider]">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </div>
      ) : (customers ?? []).length === 0 ? (
        <EmptyState icon={<Users size={48} />} heading="No customers found" />
      ) : (
        <div className="divide-y divide-[--color-divider] px-4">
          {customers!.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/customers/${c.id}`)}
              className="flex w-full min-h-11 items-center gap-3 py-3 text-left"
            >
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-md font-semibold text-text-primary">{c.name}</p>
                <p className="truncate text-sm text-text-secondary">{c.phone}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium text-text-primary">{formatKes(c.totalSpentKes ?? 0)}</p>
                <p className="text-xs text-text-secondary">
                  {c.lastBookingAt ? timeAgo(c.lastBookingAt) : "No visits yet"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
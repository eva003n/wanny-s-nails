/**
 * §8.1 Payments Page
 *
 * Single-column card list (no tables — §1.2 anti-pattern).
 * §7.2: Empty state with icon + CTA.
 * §7.1: Skeleton loading.
 * §8.1: KES amounts prefixed, comma-separated, tabular-nums.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Avatar from "@/components/ui/Avatar";
import Badge, { paymentStatusToBadge } from "@/components/ui/Badge";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { ListRowSkeleton } from "@/components/ui/Skeleton";
import { usePayments } from "@/pages/payments/hooks/usePayments";
import { formatDateShort, formatKes, formatTime } from "@/lib/format";
import Pagination from "@/components/ui/Pagination";

type Period = "today" | "week" | "month" | "all";

export default function PaymentsListPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("week");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { data: result, isLoading, error, refetch } = usePayments(
    { period },
    page,
    limit,
  );

  const payments = useMemo(() => result?.data ?? [], [result?.data]);
  const meta = result?.meta;

  const totalKes = useMemo(
    () =>
      payments
        .filter((p) => p.status === "SUCCESS")
        .reduce((sum, p) => sum + p.amountKes, 0),
    [payments],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Payments" />

      <div className="flex flex-col gap-4 px-4 py-4">
        <SegmentedControl
          aria-label="Filter payments by period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "all", label: "All" },
          ]}
        />

        <div className="rounded-[--radius-md] bg-primary-light p-4">
          <p className="text-sm text-primary-dark">Total collected</p>
          <p className="text-2xl font-bold text-primary-dark">
            {formatKes(totalKes)}
          </p>
        </div>
      </div>

      {error ? (
        <ErrorState message="Failed to load payments." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="divide-y divide-[--color-divider]">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState icon={CreditCard} heading="No payments in this period" />
      ) : (
        <>
          <div className="divide-y divide-[--color-divider] px-4">
            {payments.map((p) => {
              const badge = paymentStatusToBadge(p.status);
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/payments/${p.id}`)}
                  className="flex w-full min-h-11 items-center gap-3 py-3 text-left"
                >
                  <Avatar name={p.customer.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {p.customer.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {p.booking.services?.[0]?.service?.name ?? "Nail Service"} · {formatDateShort(p.createdAt)}{" "}
                      {formatTime(p.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-text-primary">
                      {formatKes(p.amountKes)}
                    </p>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </button>
              );
            })}
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
  );
}

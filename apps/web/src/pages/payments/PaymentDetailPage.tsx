/* import { useParams } from "react-router-dom";
import { usePayment } from "@/pages/payments/hooks/usePayments";
import Badge, { paymentStatusToBadge } from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) throw new Error("Missing payment ID");

  const { data: payment, isLoading, error, refetch } = usePayment(id);

  if (isLoading) return <div className="px-6 py-8 text-center text-text-secondary">Loading...</div>;
  if (error) return <ErrorState message="Failed to load payment details." onRetry={refetch} />;
  if (!payment) return <div className="px-6 py-8 text-center text-text-secondary">Payment not found</div>;

  const badge = paymentStatusToBadge(payment.status);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold text-text-primary">Payment — {payment.booking.reference}</h1>

      <div className="rounded-[--radius-md] bg-surface p-6 shadow-[--shadow-card]">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Payment Details</h2>
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-sm text-text-secondary">Amount</dt>
            <dd className="text-sm font-medium text-text-primary">KES {payment.amountKes.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-text-secondary">Status</dt>
            <dd>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-text-secondary">M-Pesa Receipt</dt>
            <dd className="text-sm font-medium text-text-primary">{payment.mpesaReceiptNumber ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-text-secondary">Customer</dt>
            <dd className="text-sm font-medium text-text-primary">{payment.customer.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-text-secondary">Service</dt>
            <dd className="text-sm font-medium text-text-primary">{payment.booking.service.name}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
} */

import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  CalendarDays,
  Receipt,
  Banknote,
} from "lucide-react";
import { usePayment } from "@/pages/payments/hooks/usePayments";
import Badge, { paymentStatusToBadge } from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import Avatar from "@/components/ui/Avatar";
import { formatKes, formatDate, formatTime } from "@/lib/format";

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-surface-raised" />
      <div className="rounded-[--radius-lg] bg-surface p-6 space-y-4 shadow-[--shadow-card]">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-surface-raised" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-surface-raised" />
            <div className="h-3 w-24 rounded bg-surface-raised" />
          </div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-24 rounded bg-surface-raised" />
            <div className="h-3 w-20 rounded bg-surface-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) throw new Error("Missing payment ID");

  const { data: payment, isLoading, error, refetch } = usePayment(id);

  if (isLoading) return <Skeleton />;
  if (error)
    return (
      <ErrorState message="Failed to load payment details." onRetry={refetch} />
    );
  if (!payment)
    return (
      <div className="px-6 py-8 text-center text-text-secondary">
        Payment not found
      </div>
    );

  const badge = paymentStatusToBadge(payment.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text-primary leading-tight">
            {payment.booking.reference}
          </h1>
          <p className="text-sm text-text-secondary">Payment details</p>
        </div>
      </div>

      {/* Amount hero */}
      <div className="rounded-[--radius-lg] bg-primary-light p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-primary-dark/70">Amount</p>
          <p className="text-3xl font-bold text-primary-dark">
            {formatKes(payment.amountKes)}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Customer card */}
      <div className="rounded-[--radius-lg] bg-surface shadow-[--shadow-card] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-disabled mb-3">
          Customer
        </p>
        <div className="flex items-center gap-3">
          <Avatar name={payment.customer.name} />
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">
              {payment.customer.name}
            </p>
            <a
              href={`https://wa.me/${payment.phoneNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary"
            >
              <Phone className="h-3.5 w-3.5" />
              {payment.customer.phone}
            </a>
          </div>
        </div>
      </div>

      {/* Booking card */}
      <div className="rounded-[--radius-lg] bg-surface shadow-[--shadow-card] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-disabled">
          Booking
        </p>
        <Row
          icon={CalendarDays}
          label="Service"
          value={payment.booking.service.name}
        />
        <Row
          icon={Receipt}
          label="Reference"
          value={payment.booking.reference}
        />
        <Row
          icon={CalendarDays}
          label="Date"
          value={`${formatDate(payment.createdAt)} at ${formatTime(payment.createdAt)}`}
        />
      </div>

      {/* M-Pesa card */}
      <div className="rounded-[--radius-lg] bg-surface shadow-[--shadow-card] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-disabled">
          M-Pesa
        </p>
        <Row
          icon={Banknote}
          label="Receipt no."
          value={payment.mpesaReceiptNumber ?? "—"}
          mono={!!payment.mpesaReceiptNumber}
        />
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </div>
      <span
        className={`text-sm font-medium text-text-primary text-right ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

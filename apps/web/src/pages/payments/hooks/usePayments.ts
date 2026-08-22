import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import {
  PaginatedPaymentsSchema,
  type PaymentTransaction,
  type PaymentStatus,
  type Booking,
} from "@/lib/schemas";

export const paymentKeys = {
  all: ["payments"] as const,
  list: (filters?: Record<string, string>) =>
    ["payments", "list", filters] as const,
  detail: (id: string) => ["payments", "detail", id] as const,
};

export interface PaymentFilters {
  period?: "today" | "week" | "month" | "all";
}

export interface PaymentMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaymentsResult {
  data: PaymentTransaction[];
  meta?: PaymentMeta;
}

/**
 * Fields normalizePayment() reads, covering both the validated /payments
 * response shape (RawPayment) and the hand-built /bookings fallback shape.
 */
interface NormalizablePayment {
  id: string;
  bookingId?: string;
  phoneNumber?: string | null;
  reference?: string;
  amountKes?: number | null;
  status?: PaymentStatus;
  mpesaReceiptNumber?: string | null;
  createdAt?: string;
  booking?: {
    id?: string;
    reference?: string;
    services?: Array<{ service?: { id?: string; name?: string } }>;
    service?: { id?: string; name?: string };
    customer?: { id?: string; name?: string; phone?: string };
  };
  customer?: { id?: string; name?: string; phone?: string };
}

/**
 * Normalize a backend payment record into PaymentTransaction shape.
 * The backend returns `customer` nested inside `booking`, and `method`
 * is not present — we infer it from the payment context.
 */
function normalizePayment(p: NormalizablePayment): PaymentTransaction {
  // Extract service name from new services[] or old service relation
  const services = p.booking?.services;
  const firstService = Array.isArray(services) ? services[0] : undefined;
  const serviceName = firstService?.service?.name ?? p.booking?.service?.name ?? "";
  const serviceId = firstService?.service?.id ?? p.booking?.service?.id ?? "";
  const normalizedServices = Array.isArray(services)
    ? services.map((s) => ({
        service: {
          id: s.service?.id ?? "",
          name: s.service?.name ?? "",
        },
      }))
    : undefined;
  return {
    id: p.id,
    bookingId: p.bookingId ?? p.booking?.id ?? "",
    phoneNumber: p.phoneNumber ?? "",
    booking: {
      id: p.bookingId ?? p.booking?.id ?? "",
      reference: p.booking?.reference ?? p.reference ?? "",
      service: {
        id: serviceId,
        name: serviceName,
      },
      services: normalizedServices,
    },
    customer: {
      id: p.booking?.customer?.id ?? p.customer?.id ?? "",
      name: p.booking?.customer?.name ?? p.customer?.name ?? "",
      phone: p.booking?.customer?.phone ?? p.customer?.phone ?? "",
    },
    amountKes: p.amountKes ?? 0,
    status: p.status ?? "PENDING",
    mpesaReceiptNumber: p.mpesaReceiptNumber ?? null,
    method: "MPESA",
    createdAt: p.createdAt ?? new Date().toISOString(),
  };
}

export function usePayments(
  filters: PaymentFilters = {},
  page = 1,
  limit = 20,
) {
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};

    // Convert period filter to date range
    if (filters.period && filters.period !== "all") {
      const now = new Date();
      let from: Date;
      switch (filters.period) {
        case "today":
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week": {
          const dayOfWeek = now.getDay();
          from = new Date(now);
          from.setDate(now.getDate() - dayOfWeek);
          from.setHours(0, 0, 0, 0);
          break;
        }
        case "month":
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      params.from = from!.toISOString();
      params.to = now.toISOString();
    }

    params.page = String(page);
    params.limit = String(limit);
    return params;
  }, [filters.period, page, limit]);

  return useQuery<PaymentsResult>({
    queryKey: paymentKeys.list(queryParams),
    queryFn: async () => {
      // First try the dedicated /payments endpoint
      try {
        const { data } = await api.get("/payments", { params: queryParams });
        const validated = validateOrThrow(
          PaginatedPaymentsSchema,
          data,
          "GET /payments",
        );
        return {
          data: validated.data.map(normalizePayment),
          meta: validated.meta
            ? {
                page: validated.meta.page,
                limit: validated.meta.limit,
                total: validated.meta.total,
                totalPages: validated.meta.totalPages,
                hasNextPage: validated.meta.hasNextPage,
                hasPrevPage: validated.meta.hasPrevPage,
              }
            : undefined,
        };
      } catch {
        // Fall back to /bookings if /payments fails
      }

      // Fallback: fetch bookings with payment info
      const { data } = await api.get("/bookings", { params: queryParams });
      const bookings = (data.data ?? data) as Booking[];
      if (!Array.isArray(bookings)) return { data: [] };

      const payments = bookings
        .filter((b) => b.payment)
        .map((b) => {
          // filtered above — payment is guaranteed present here
          const payment = b.payment!;
          return normalizePayment({
            id: payment.id,
            bookingId: b.id,
            booking: {
              id: b.id,
              reference: b.reference,
              customer: b.customer,
              services: b.services,
            },
            customer: b.customer,
            amountKes: payment.amountKes,
            status: payment.status,
            mpesaReceiptNumber: payment.mpesaReceiptNumber,
            createdAt: payment.createdAt,
          });
        });

      return { data: payments };
    },
    staleTime: 30_000,
  });
}

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: paymentKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get(`/payments/${id}`);
      const raw = data.data ?? data;
      return normalizePayment(raw);
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
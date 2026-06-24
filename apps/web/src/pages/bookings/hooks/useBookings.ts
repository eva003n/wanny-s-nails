import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { emitSSE } from "@/lib/sseBus";
import { validateOrThrow } from "@/lib/guards";
import {
  BookingListSchema,
  BookingSchema,
  AvailableSlotsResponseSchema,
  PaginatedBookingsSchema,
} from "@/lib/schemas";
import type { Booking, BookingFilters } from "@/lib/schemas";

export interface BookingMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface BookingsResult {
  data: Booking[];
  meta?: BookingMeta;
}

export const bookingKeys = {
  all: ["bookings"] as const,
  list: (filters: BookingFilters) => ["bookings", "list", filters] as const,
  detail: (id: string) => ["bookings", "detail", id] as const,
  history: (id: string) => ["bookings", "history", id] as const,
  today: () => ["bookings", "today"] as const,
};

export function useBookings(filters: BookingFilters = {}) {
  // If tab is "today", use the dedicated /bookings/today endpoint
  if (filters.tab === "today") {
    return useQuery<BookingsResult>({
      queryKey: bookingKeys.today(),
      queryFn: async () => {
        const { data } = await api.get("/bookings/today");
        const bookings = validateOrThrow(
          BookingListSchema,
          data.data ?? data,
          "GET /bookings/today",
        );
        return { data: bookings };
      },
      staleTime: 30_000,
    });
  }

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  // Otherwise, use the general /bookings endpoint with filters
  return useQuery<BookingsResult>({
    queryKey: bookingKeys.list({ ...filters, page, limit }),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.status) params.status = filters.status;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      params.page = String(page);
      params.limit = String(limit);
      const { data } = await api.get("/bookings", { params });
      const validated = validateOrThrow(
        PaginatedBookingsSchema,
        data,
        "GET /bookings",
      );
      return {
        data: validated.data,
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
    },
    staleTime: 30_000,
  });
}

export function useBooking(id: string | undefined) {
  return useQuery<Booking>({
    queryKey: bookingKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get(`/bookings/${id}`);
      return validateOrThrow(BookingSchema, data.data, `GET /bookings/${id}`);
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useTodayBookings() {
  return useQuery<Booking[]>({
    queryKey: bookingKeys.today(),
    queryFn: async () => {
      const { data } = await api.get("/bookings/today");
      return validateOrThrow(
        BookingListSchema,
        data.data ?? data,
        "GET /bookings/today",
      );
    },
    staleTime: 30_000,
  });
}

export function useBookingDetail(id: string) {
  return useQuery<Booking>({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/bookings/${id}`);
      return validateOrThrow(BookingSchema, data.data, `GET /bookings/${id}`);
    },
    staleTime: 60_000,
  });
}

/** @deprecated No backend /bookings/:id/history endpoint exists yet — falls back to booking detail. */
export function useBookingHistory(id: string | undefined) {
  return useQuery<Booking>({
    queryKey: bookingKeys.history(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get(`/bookings/${id}`);
      return validateOrThrow(BookingSchema, data.data, `GET /bookings/${id}`);
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

// Lightweight derived hook for nav badge — uses the "all" cache slice.
export function usePendingCount(): number {
  const result = useBookings({});
  const bookings: Booking[] = Array.isArray(result.data)
    ? result.data
    : "data" in (result.data ?? {})
      ? (result.data as any).data
      : [];
  return bookings.filter((b: any) => b.status === "PENDING").length;
}

function updateCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updated: Booking,
) {
  queryClient.setQueryData(bookingKeys.detail(updated.id), updated);
  queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useApproveBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data } = await api.post(`/bookings/${bookingId}/approve`);
      return validateOrThrow(
        BookingSchema,
        data.data,
        "POST /bookings/:id/approve",
      );
    },
    onSuccess: (updatedBooking) => {
      updateCaches(queryClient, updatedBooking);
      emitSSE("booking.approved");
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      reason,
    }: {
      bookingId: string;
      reason?: string;
    }) => {
      const { data } = await api.post(`/bookings/${bookingId}/cancel`, {
        reason,
      });
      return validateOrThrow(
        BookingSchema,
        data.data,
        "POST /bookings/:id/cancel",
      );
    },
    onSuccess: (updatedBooking) => {
      updateCaches(queryClient, updatedBooking);
      emitSSE("booking.cancelled");
    },
  });
}

export function useRescheduleBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookingId,
      newStartAt,
      reason,
    }: {
      bookingId: string;
      newStartAt: string;
      reason?: string;
    }) => {
      const { data } = await api.post(`/bookings/${bookingId}/reschedule`, {
        appointmentAt: newStartAt,
        reason,
      });
      return validateOrThrow(
        BookingSchema,
        data.data,
        `POST /bookings/:id/reschedule`,
      );
    },
    onSuccess: (updated) => {
      updateCaches(queryClient, updated);
      emitSSE("booking.rescheduled");
    },
  });
}

/** @deprecated No POST /bookings/:id/complete endpoint exists on the backend yet. */
export function useMarkBookingComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data } = await api.post(`/bookings/${bookingId}/complete`);
      return validateOrThrow(
        BookingSchema,
        data.data,
        "POST /bookings/:id/complete",
      );
    },
    onSuccess: (updated) => updateCaches(queryClient, updated),
  });
}

export function useMarkPaymentManually() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data } = await api.post(`/bookings/${bookingId}/mark-paid`, {
        method: "CASH",
      });
      return validateOrThrow(
        BookingSchema,
        data.data,
        "POST /bookings/:id/mark-paid",
      );
    },
    onSuccess: (updated) => {
      updateCaches(queryClient, updated);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      emitSSE("payment.completed");
    },
  });
}

export function useSendPaymentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookingId,
      phoneNumber,
    }: {
      bookingId: string;
      phoneNumber: string;
    }) => {
      const { data } = await api.post("/payments/stk-push", {
        bookingId,
        phoneNumber,
      });
      return validateOrThrow(
        BookingSchema,
        data.data,
        "POST /payments/stk-push",
      );
    },
    onSuccess: (updated) => updateCaches(queryClient, updated),
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customerId?: string;
      newCustomer?: { name: string; phone: string };
      serviceId: string;
      appointmentAt: string;
    }) => {
      // POST /bookings only accepts customerId (not newCustomer),
      // so we assume newCustomer is resolved to an id upstream or passed as customerId.
      const { data } = await api.post("/bookings", {
        customerId: input.customerId,
        serviceId: input.serviceId,
        appointmentAt: input.appointmentAt,
      });
      return validateOrThrow(BookingSchema, data.data, "POST /bookings");
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.setQueryData(bookingKeys.detail(created.id), created);
      emitSSE("booking.created");
    },
  });
}

export function useAvailableSlots(
  serviceId: string | undefined,
  date: string | undefined,
) {
  return useQuery({
    queryKey: ["slots", serviceId, date],
    queryFn: async () => {
      const { data } = await api.get("/slots/availability", {
        params: { serviceId, date },
      });
      const validated = validateOrThrow(
        AvailableSlotsResponseSchema,
        data.data,
        "GET /slots/availability",
      );
      return validated.slots;
    },
    enabled: !!serviceId && !!date,
    staleTime: 15_000,
  });
}

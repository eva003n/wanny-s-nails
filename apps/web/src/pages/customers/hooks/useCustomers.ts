import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import {
  CustomerSchema,
  BookingListSchema,
  PaginatedCustomersSchema,
} from "@/lib/schemas";
import type { Customer } from "@/lib/schemas";

export interface CustomerMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CustomersResult {
  data: Customer[];
  meta?: CustomerMeta;
}

export const customerKeys = {
  all: ["customers"] as const,
  list: (search?: string, page?: number, limit?: number) =>
    ["customers", "list", search, page, limit] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
  bookings: (id: string) => ["customers", "bookings", id] as const,
};

export function useCustomers(
  search?: string,
  page = 1,
  limit = 10,
  enabled = true,
): UseQueryResult<CustomersResult, Error> {
  return useQuery<CustomersResult>({
    enabled,
    queryKey: customerKeys.list(search, page, limit),
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (search) params.search = search;
      params.page = String(page);
      params.limit = String(limit);
      const { data } = await api.get("/customers", { params });
      const validated = validateOrThrow(
        PaginatedCustomersSchema,
        data,
        "GET /customers",
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
    staleTime: 60_000,
  });
}


export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/customers/${id}`);
      // Backend returns { ...customer, stats: { totalBookings, totalSpentKes, lastBookingAt } }
      const raw = data.data;
      const flattened = {
        ...raw,
        totalBookings: raw.stats?.totalBookings ?? 0,
        totalSpentKes: raw.stats?.totalSpentKes ?? 0,
        lastBookingAt: raw.stats?.lastBookingAt ?? null,
      };
      return validateOrThrow(CustomerSchema, flattened, `GET /customers/${id}`);
    },
    staleTime: 60_000,
  });
}

export function useCustomerBookings(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.bookings(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get(`/customers/${id!}/bookings`);
      return validateOrThrow(
        BookingListSchema,
        data.data ?? data,
        `GET /customers/${id}/bookings`,
      );
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}
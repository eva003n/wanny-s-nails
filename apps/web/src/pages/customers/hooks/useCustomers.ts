import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import { CustomerSchema, BookingListSchema } from "@/lib/schemas";
import type { Customer } from "@/lib/schemas";

export const customerKeys = {
  all: ["customers"] as const,
  list: (search?: string) => ["customers", "list", search] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
  bookings: (id: string) => ["customers", "bookings", id] as const,
};

export function useCustomers(search?: string) {
  return useQuery<Customer[]>({
    queryKey: customerKeys.list(search),
    queryFn: async () => {
      const params = search ? { search } : {};
      const { data } = await api.get("/customers", { params });
      return validateOrThrow(
        CustomerSchema.array(),
        data.data ?? data,
        "GET /customers",
      );
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
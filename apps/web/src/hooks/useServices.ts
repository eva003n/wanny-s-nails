import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import { ServiceSchema, AvailableSlotsResponseSchema } from "@/lib/schemas";
import { z } from "zod";
import type { Service } from "@/lib/schemas";

export const serviceKeys = {
  all: ["services"] as const,
  list: () => ["services", "list"] as const,
  detail: (id: string) => ["services", "detail", id] as const,
};

export function useServices() {
  return useQuery<Service[]>({
    queryKey: serviceKeys.list(),
    queryFn: async () => {
      const { data } = await api.get("/services");
      const validated = validateOrThrow(
        z.array(ServiceSchema),
        data.data,
        "GET /services",
      );
      return validated;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      category: Service["category"];
      durationMinutes: number;
      priceKes: number;
    }) => {
      const { data } = await api.post("/services", input);
      return validateOrThrow(ServiceSchema, data.data, "POST /services");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Service> & { id: string }) => {
      const { data } = await api.patch(`/services/${id}`, updates);
      return validateOrThrow(ServiceSchema, data.data, "PATCH /services/:id");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    },
  });
}

export function useAvailableSlots(
  serviceIds: string[],
  date: string | undefined,
) {
  return useQuery({
    queryKey: ["slots", serviceIds, date],
    queryFn: async () => {
      const { data } = await api.get("/slots/availability", {
        params: { serviceIds: serviceIds.join(","), date },
      });
      const validated = validateOrThrow(
        AvailableSlotsResponseSchema,
        data.data,
        "GET /slots/availability",
      );
      return validated.slots;
    },
    enabled: serviceIds.length > 0 && !!date,
    staleTime: 15_000,
  });
}
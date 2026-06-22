import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import { ServiceSchema, AvailableSlotsResponseSchema } from "@/lib/schemas";
import { z } from "zod";
import type { Service } from "@/lib/schemas";

export function useServices() {
  return useQuery<Service[]>({
    queryKey: ["services"],
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

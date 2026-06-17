import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface BusinessHoursEntry {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isActive: boolean;
}

export const hoursKeys = {
  all: ["business-hours"] as const,
};

export function useBusinessHours() {
  return useQuery<BusinessHoursEntry[]>({
    queryKey: hoursKeys.all,
    queryFn: async () => {
      const { data } = await api.get("/business-hours");
      return data.data ?? data;
    },
  });
}

export function useUpdateBusinessHours() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (hours: BusinessHoursEntry[]) => {
      const { data } = await api.patch("/business-hours", { hours });
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hoursKeys.all });
    },
  });
}
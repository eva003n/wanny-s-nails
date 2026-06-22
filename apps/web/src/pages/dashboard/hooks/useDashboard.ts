import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import { DashboardStatsSchema, type DashboardStats } from "@/lib/schemas";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/stats");
      const raw = data.data ?? data;
      return validateOrThrow(DashboardStatsSchema, raw, "GET /dashboard/stats");
    },
    staleTime: 30_000,
  });
}
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import {
  NotificationListSchema,
  UnreadCountSchema,
} from "@/lib/notification-schemas";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (page?: number) => ["notifications", "list", page] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

export function useNotifications(page = 1) {
  return useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: async () => {
      const { data } = await api.get("/notifications", {
        params: { page, limit: 50 },
      });
      return validateOrThrow(NotificationListSchema, data, "GET /notifications");
    },
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => {
      const response = await api.get("/notifications/unread-count");
      return validateOrThrow(UnreadCountSchema, response.data.data, "GET /notifications/unread-count");
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // poll every minute as fallback
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.patch(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      // Update the specific notification's readAt in cache
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.setQueryData(notificationKeys.unreadCount, (old: { count: number } | undefined) => {
        if (!old) return old;
        return { count: Math.max(0, old.count - 1) };
      });
    },
  });
}
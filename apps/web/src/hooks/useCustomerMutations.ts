/**
 * Mutation hooks for customer CRUD.
 *
 * Follows the same pattern as @/hooks/useServices.ts.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import { CustomerSchema } from "@/lib/schemas";
import { customerKeys } from "@/pages/customers/hooks/useCustomers";

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      phone: string;
      email?: string;
    }) => {
      const { data } = await api.post("/customers", input);
      return validateOrThrow(CustomerSchema, data.data, "POST /customers");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      phone?: string;
      email?: string;
    }) => {
      const { data } = await api.patch(`/customers/${id}`, updates);
      return validateOrThrow(CustomerSchema, data.data, "PATCH /customers/:id");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({
        queryKey: customerKeys.detail(variables.id),
      });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}
/**
 * §8.3 Customers Page
 *
 * Single-column card list (no tables — §1.2 anti-pattern).
 * §6.1: Search input with label above.
 * §7.2: Empty state with icon + CTA.
 * §7.1: Skeleton loading.
 *
 * Supports add, edit, and delete via BottomSheet and confirmation dialog
 * (matching the ServicesSection pattern in settings).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, CirclePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import PageHeader from "@/components/layout/PageHeader";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { ListRowSkeleton } from "@/components/ui/Skeleton";
import BottomSheet from "@/components/ui/BottomSheet";
import { useCustomers } from "@/pages/customers/hooks/useCustomers";
import {
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from "@/hooks/useCustomerMutations";
import { useUiStore } from "@/store/ui.store";
import { formatKes, timeAgo } from "@/lib/format";
import type { Customer } from "@/lib/schemas";
import Pagination from "@/components/ui/Pagination";

// ─── Form schema (mirrors backend validation) ────────────────────────────────

const CustomerFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .min(10, "Phone number is required")
    .transform((val) => {
      // Convert 07xx/01xx → 2547xx/2541xx
      const cleaned = val.replace(/[^0-9]/g, "");
      if (cleaned.startsWith("0")) return `254${cleaned.slice(1)}`;
      if (cleaned.startsWith("7") || cleaned.startsWith("1"))
        return `254${cleaned}`;
      return cleaned;
    })
    .refine(
      (val) => /^254[17]\d{8}$/.test(val),
      "Invalid Kenyan phone number (e.g. 0712345678)",
    ),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
});

type CustomerFormData = z.infer<typeof CustomerFormSchema>;

// ─── Extract error helper ────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string | null {
  if (err && typeof err === "object") {
    const axiosErr = err as {
      response?: { data?: { error?: { message?: string } } };
      message?: string;
    };
    if (axiosErr.response?.data?.error?.message) {
      return axiosErr.response.data.error.message;
    }
    if (axiosErr.message && !axiosErr.message.startsWith("Request failed")) {
      return axiosErr.message;
    }
  }
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: result, isLoading, error, refetch } = useCustomers(
    search || undefined,
    page,
    limit,
  );
  const customers: Customer[] = result?.data ?? [];
  const meta = result?.meta;

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const showToast = useUiStore((s) => s.showToast);

  // BottomSheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Delete confirmation state
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(CustomerFormSchema),
    defaultValues: { name: "", phone: "", email: "" },
  });

  // ─── Handlers ───────────────────────────────────────────────────────────

  const openAddSheet = () => {
    setEditingCustomer(null);
    reset({ name: "", phone: "", email: "" });
    setSheetOpen(true);
  };

  const openEditSheet = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
    });
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingCustomer(null);
    reset();
  };

  const onSubmit = (data: CustomerFormData) => {
    const payload = {
      name: data.name,
      phone: data.phone,
      email: data.email || undefined,
    };

    if (editingCustomer) {
      updateCustomer.mutate(
        { id: editingCustomer.id, ...payload },
        {
          onSuccess: () => {
            showToast({ type: "success", message: "Customer updated." });
            closeSheet();
          },
          onError: (err: unknown) => {
            const msg =
              extractErrorMessage(err) || "Failed to update customer.";
            showToast({ type: "error", message: msg });
          },
        },
      );
    } else {
      createCustomer.mutate(payload, {
        onSuccess: () => {
          showToast({ type: "success", message: "Customer added." });
          closeSheet();
        },
        onError: (err: unknown) => {
          const msg =
            extractErrorMessage(err) || "Failed to add customer.";
          showToast({ type: "error", message: msg });
        },
      });
    }
  };

  const confirmDelete = () => {
    if (!deletingCustomer) return;
    deleteCustomer.mutate(deletingCustomer.id, {
      onSuccess: () => {
        showToast({ type: "success", message: "Customer deleted." });
        setDeletingCustomer(null);
      },
      onError: (err: unknown) => {
        const msg =
          extractErrorMessage(err) || "Failed to delete customer.";
        showToast({ type: "error", message: msg });
        setDeletingCustomer(null);
      },
    });
  };

  const isFormPending =
    createCustomer.isPending || updateCustomer.isPending;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Customers" />

      <div className="px-4 py-4 space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            aria-label="Search customers by name or phone"
            className="min-h-11 w-full rounded-[--radius-md] border border-border bg-surface-raised pl-9 pr-3 text-base text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
        </div>

        {/* Add button */}
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={openAddSheet}
            style={{ width: "auto", padding: "0 var(--space-16)" }}
          >
            <CirclePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add Customer
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState
          message="Couldn't load your clients."
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="divide-y divide-[--color-divider]">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState icon={Users} heading="No customers found" />
      ) : (
        <div>
          <div className="divide-y divide-[--color-divider] px-4">
            {customers.map((c) => (
              <div
                key={c.id}
                className="flex w-full min-h-11 items-center gap-3 py-3"
              >
                <button
                  onClick={() => navigate(`/customers/${c.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-md font-semibold text-text-primary">
                      {c.name}
                    </p>
                    <p className="truncate text-sm text-text-secondary">
                      {c.phone}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-text-primary">
                      {formatKes(c.totalSpentKes ?? 0)}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {c.lastBookingAt
                        ? timeAgo(c.lastBookingAt)
                        : "No visits yet"}
                    </p>
                  </div>
                </button>

                {/* Action buttons */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEditSheet(c)}
                    className="flex h-11 w-11 items-center justify-center rounded-[--radius-md] text-sm font-medium text-primary hover:bg-primary-light/20"
                    aria-label={`Edit ${c.name}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingCustomer(c)}
                    className="flex h-11 w-11 items-center justify-center rounded-[--radius-md] text-sm font-medium text-error hover:bg-error/10"
                    aria-label={`Delete ${c.name}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {meta && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
              limit={meta.limit}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* ─── Add / Edit Bottom Sheet ─────────────────────────────────────── */}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingCustomer ? "Edit Customer" : "Add Customer"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(onSubmit)();
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Full name"
            type="text"
            {...register("name")}
            error={errors.name?.message}
          />

          <Input
            label="Phone number"
            type="tel"
            inputMode="tel"
            placeholder="0712345678"
            {...register("phone")}
            error={errors.phone?.message}
          />

          <Input
            label="Email (optional)"
            type="email"
            inputMode="email"
            {...register("email")}
            error={errors.email?.message}
          />

          <div className="flex gap-2">
            <Button type="submit" loading={isFormPending}>
              {editingCustomer ? "Save Changes" : "Add Customer"}
            </Button>
            <Button variant="secondary" onClick={closeSheet}>
              Cancel
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* ─── Delete confirmation dialog ──────────────────────────────────── */}
      {deletingCustomer && (
        <dialog
          open
          className="fixed inset-0 z-60 m-auto border-none bg-transparent p-0"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setDeletingCustomer(null)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Delete customer"
            className="relative z-10 mx-auto mt-[30vh] max-w-[320px] rounded-[--radius-lg] bg-surface p-6 shadow-[--shadow-modal]"
          >
            <p className="m-0 text-[17px] font-semibold text-text-primary">
              Delete customer?
            </p>
            <p className="my-2 text-[15px] text-text-secondary">
              "{deletingCustomer.name}" will be removed. It cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                loading={deleteCustomer.isPending}
                onClick={confirmDelete}
              >
                Delete
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDeletingCustomer(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
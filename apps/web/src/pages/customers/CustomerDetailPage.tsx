import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageCircle, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import PageHeader from "@/components/layout/PageHeader";
import Avatar from "@/components/ui/Avatar";
import Badge, { bookingStatusToBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import BottomSheet from "@/components/ui/BottomSheet";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton, { ListRowSkeleton } from "@/components/ui/Skeleton";
import { useCustomer, useCustomerBookings } from "@/pages/customers/hooks/useCustomers";
import {
  useUpdateCustomer,
  useDeleteCustomer,
} from "@/hooks/useCustomerMutations";
import { useUiStore } from "@/store/ui.store";
import { formatDateShort, formatKes, formatPhoneForWhatsApp, formatTime } from "@/lib/format";
// import type { Customer } from "@/lib/schemas";re

// ─── Form schema ─────────────────────────────────────────────────────────────

const EditCustomerFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
});

type EditCustomerFormData = z.infer<typeof EditCustomerFormSchema>;

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

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) throw new Error("Missing customer ID");

  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: bookings, isLoading: bookingsLoading } = useCustomerBookings(id);

  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const showToast = useUiStore((s) => s.showToast);

  // Edit sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditCustomerFormData>({
    resolver: zodResolver(EditCustomerFormSchema),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────

  const openEditSheet = () => {
    if (!customer) return;
    reset({
      name: customer.name,
      email: customer.email ?? "",
    });
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    reset();
  };

  const onSubmit = (data: EditCustomerFormData) => {
    updateCustomer.mutate(
      {
        id,
        name: data.name,
        email: data.email || undefined,
      },
      {
        onSuccess: () => {
          showToast({ type: "success", message: "Customer updated." });
          closeSheet();
        },
        onError: (err: unknown) => {
          const msg = extractErrorMessage(err) || "Failed to update customer.";
          showToast({ type: "error", message: msg });
        },
      },
    );
  };

  const confirmDelete = () => {
    deleteCustomer.mutate(id, {
      onSuccess: () => {
        showToast({ type: "success", message: "Customer deleted." });
        navigate("/customers", { replace: true });
      },
      onError: (err: unknown) => {
        const msg = extractErrorMessage(err) || "Failed to delete customer.";
        showToast({ type: "error", message: msg });
        setDeleting(false);
      },
    });
  };

  if (isLoading || !customer) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Customer" />
        <div className="space-y-4 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Customer" />
        <ErrorState message="Failed to load customer details." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Customer"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={openEditSheet}
              className="text-sm font-medium text-primary"
            >
              Edit
            </button>
            <button
              onClick={() => setDeleting(true)}
              className="text-sm font-medium text-error"
            >
              Delete
            </button>
          </div>
        }
      />

      <div className="px-4 py-5">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-text-primary">{customer.name}</p>
            <p className="truncate text-sm text-text-secondary">{customer.phone}</p>
            {customer.email && (
              <p className="truncate text-sm text-text-tertiary">{customer.email}</p>
            )}
          </div>
          <a
            href={`https://wa.me/${formatPhoneForWhatsApp(customer.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-1.5 rounded-[--radius-lg] bg-success-bg px-3 text-sm font-semibold text-success"
            aria-label={`Open WhatsApp chat with ${customer.name}`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[--radius-md] bg-surface p-4 shadow-[--shadow-card]">
            <p className="text-2xl font-bold text-text-primary">{customer.totalBookings ?? 0}</p>
            <p className="text-sm text-text-secondary">Total Bookings</p>
          </div>
          <div className="rounded-[--radius-md] bg-surface p-4 shadow-[--shadow-card]">
            <p className="text-2xl font-bold text-text-primary">{formatKes(customer.totalSpentKes ?? 0)}</p>
            <p className="text-sm text-text-secondary">Total Spent</p>
          </div>
        </div>

        <section className="mt-7">
          <h2 className="text-md font-semibold text-text-primary">Booking History</h2>
          <div className="mt-3 divide-y divide-[--color-divider] rounded-[--radius-md] bg-surface shadow-[--shadow-card]">
            {bookingsLoading ? (
              <>
                <ListRowSkeleton />
                <ListRowSkeleton />
              </>
            ) : (bookings ?? []).length === 0 ? (
              <EmptyState icon={Calendar} heading="No bookings yet" />
            ) : (
              bookings!.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{b.services?.[0]?.service?.name ?? b.service?.name ?? "Nail Service"}</p>
                    <p className="text-xs text-text-secondary">
                      {formatDateShort(b.appointmentAt)} · {formatTime(b.appointmentAt)}
                    </p>
                  </div>
                  <Badge variant={bookingStatusToBadge(b.status).variant}>
                    {bookingStatusToBadge(b.status).label}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ─── Edit Bottom Sheet ──────────────────────────────────────────── */}
      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Edit Customer"
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
            label="Email (optional)"
            type="email"
            inputMode="email"
            {...register("email")}
            error={errors.email?.message}
          />

          <div className="flex gap-2">
            <Button type="submit" loading={updateCustomer.isPending}>
              Save Changes
            </Button>
            <Button variant="secondary" onClick={closeSheet}>
              Cancel
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* ─── Delete confirmation dialog ──────────────────────────────────── */}
      {deleting && (
        <dialog
          open
          className="fixed inset-0 z-60 m-auto border-none bg-transparent p-0"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setDeleting(false)}
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
              "{customer.name}" will be removed. It cannot be undone.
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
                onClick={() => setDeleting(false)}
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
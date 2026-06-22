/**
 * §3.3 Services Settings — CRUD list grouped by categories
 *
 * Uses BottomSheet for add/edit, confirmation dialog for delete.
 * Services grouped by: Manicure, Pedicure, Overlay, Acrylic
 */
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
} from "../hooks/useServices";
import { useUiStore } from "@/store/ui.store";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import BottomSheet from "@/components/ui/BottomSheet";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";
import type { Service, ServiceCategory } from "@/lib/schemas";

// ─── Schema ─────────────────────────────────────────────────────────────────

const ServiceFormSchema = z.object({
  name: z.string().min(2, "Service name is required"),
  description: z.string().optional(),
  category: z.enum(["MANICURE", "OVERLAY", "PEDICURE", "ACRYLIC"]),
  durationMinutes: z.number().int().min(15, "Minimum 15 minutes").max(480),
  priceKes: z.number().int().min(1, "Price is required"),
});

type ServiceFormData = z.infer<typeof ServiceFormSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  MANICURE: "Manicure",
  PEDICURE: "Pedicure",
  OVERLAY: "Overlay",
  ACRYLIC: "Acrylic",
};

const CATEGORY_ORDER: ServiceCategory[] = ["MANICURE", "PEDICURE", "OVERLAY", "ACRYLIC"];

function formatKES(amount: number): string {
  return `KES\u00A0${amount.toLocaleString("en-KE")}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ServicesSection() {
  const { data: services = [], isLoading, error, refetch } = useServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const showToast = useUiStore((s) => s.showToast);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(ServiceFormSchema),
    defaultValues: { category: "MANICURE" },
  });

  const selectedCategory = watch("category");

  // Group services by category
  const grouped = useMemo(() => {
    const groups: Record<ServiceCategory, Service[]> = {
      MANICURE: [],
      PEDICURE: [],
      OVERLAY: [],
      ACRYLIC: [],
    };
    for (const s of services) {
      if (s.category && groups[s.category]) {
        groups[s.category].push(s);
      }
    }
    return groups;
  }, [services]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const openAddSheet = () => {
    setEditingId(null);
    reset({ name: "", description: "", category: "MANICURE", durationMinutes: 90, priceKes: 0 });
    setSheetOpen(true);
  };

  const openEditSheet = (service: Service) => {
    setEditingId(service.id);
    reset({
      name: service.name,
      description: service.description ?? "",
      category: service.category,
      durationMinutes: service.durationMinutes,
      priceKes: service.priceKes,
    });
    setSheetOpen(true);
  };

  const onSubmit = (data: ServiceFormData) => {
    if (editingId) {
      updateService.mutate(
        { id: editingId, ...data },
        {
          onSuccess: () => {
            showToast({ type: "success", message: "Service updated." });
            setSheetOpen(false);
            setEditingId(null);
            reset();
          },
          onError: () => {
            showToast({ type: "error", message: "Failed to update service." });
          },
        },
      );
    } else {
      createService.mutate(data, {
        onSuccess: () => {
          showToast({ type: "success", message: "Service added." });
          setSheetOpen(false);
          reset();
        },
        onError: () => {
          showToast({ type: "error", message: "Failed to add service." });
        },
      });
    }
  };

  const confirmDelete = () => {
    if (!deletingId) return;
    deleteService.mutate(deletingId, {
      onSuccess: () => {
        showToast({ type: "success", message: "Service deleted." });
        setDeletingId(null);
      },
      onError: () => {
        showToast({ type: "error", message: "Failed to delete service." });
        setDeletingId(null);
      },
    });
  };

  // ─── Loading ────────────────────────────────────────────────────────────

  if (error) return <ErrorState message="Couldn't load services." onRetry={refetch} />;

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton shape="text" width="50%" height="16px" />
            <div style={{ height: "var(--space-4)" }} />
            <Skeleton shape="text" width="35%" height="13px" />
          </Card>
        ))}
      </div>
    );
  }

  // ─── Empty ──────────────────────────────────────────────────────────────

  if (services.length === 0) {
    return (
      <>
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="24" cy="24" r="20" />
              <line x1="24" y1="16" x2="24" y2="32" />
              <line x1="16" y1="24" x2="32" y2="24" />
            </svg>
          }
          heading="No services configured"
          body="Add your salon services to get started."
          action={<Button onClick={openAddSheet}>Add Service</Button>}
        />
        <AddEditSheet
          open={sheetOpen}
          onClose={() => { setSheetOpen(false); setEditingId(null); reset(); }}
          onSubmit={handleSubmit(onSubmit)}
          register={register}
          errors={errors}
          setValue={setValue}
          selectedCategory={selectedCategory}
          isEditing={!!editingId}
          isPending={createService.isPending || updateService.isPending}
        />
      </>
    );
  }

  // ─── Grouped list ───────────────────────────────────────────────────────

  return (
    <>
      {/* Add button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-12)" }}>
        <Button variant="secondary" onClick={openAddSheet} style={{ width: "auto", padding: "0 var(--space-16)" }}>
          + Add Service
        </Button>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: "var(--space-20)" }}>
            <p
              style={{
                fontSize: "13px",
                lineHeight: "18px",
                letterSpacing: "0.6px",
                fontWeight: 500,
                textTransform: "uppercase",
                color: "var(--color-text-secondary)",
                marginBottom: "var(--space-8)",
              }}
            >
              {CATEGORY_LABELS[cat]}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
              {items.map((service) => (
                <Card key={service.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p
                        style={{
                          fontSize: "16px",
                          lineHeight: "22px",
                          fontWeight: 500,
                          color: "var(--color-text-primary)",
                          margin: 0,
                        }}
                      >
                        {service.name}
                      </p>
                      <p
                        style={{
                          fontSize: "13px",
                          lineHeight: "18px",
                          color: "var(--color-text-secondary)",
                          margin: "var(--space-4) 0 0",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {service.durationMinutes} min · {formatKES(service.priceKes)}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                      <button
                        onClick={() => openEditSheet(service)}
                        style={{
                          height: 44,
                          minWidth: 44,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "var(--color-primary)",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingId(service.id)}
                        style={{
                          height: 44,
                          minWidth: 44,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "var(--color-error)",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Add / Edit sheet */}
      <AddEditSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingId(null); reset(); }}
        onSubmit={handleSubmit(onSubmit)}
        register={register}
        errors={errors}
        setValue={setValue}
        selectedCategory={selectedCategory}
        isEditing={!!editingId}
        isPending={createService.isPending || updateService.isPending}
      />

      {/* Delete confirmation dialog */}
      {deletingId && (
        <dialog
          open
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            margin: "auto",
            padding: 0,
            border: "none",
            background: "transparent",
          }}
        >
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(2px)",
            }}
            onClick={() => setDeletingId(null)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Delete service"
            style={{
              position: "relative",
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-modal)",
              padding: "var(--space-24)",
              maxWidth: 320,
              margin: "auto",
              zIndex: 1,
              top: "30vh",
            }}
          >
            <p style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
              Delete service?
            </p>
            <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: "var(--space-8) 0 var(--space-16)" }}>
              This will remove the service from the list. It cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "var(--space-8)" }}>
              <Button
                variant="destructive"
                loading={deleteService.isPending}
                onClick={confirmDelete}
              >
                Delete
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDeletingId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}

// ─── Add / Edit Bottom Sheet ────────────────────────────────────────────────

function AddEditSheet({
  open,
  onClose,
  onSubmit,
  register,
  errors,
  setValue,
  selectedCategory,
  isEditing,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  register: ReturnType<typeof useForm<ServiceFormData>>["register"];
  errors: ReturnType<typeof useForm<ServiceFormData>>["formState"]["errors"];
  setValue: ReturnType<typeof useForm<ServiceFormData>>["setValue"];
  selectedCategory: ServiceCategory;
  isEditing: boolean;
  isPending: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={isEditing ? "Edit Service" : "Add Service"}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
        <Input
          label="Service name"
          type="text"
          {...register("name")}
          error={errors.name?.message}
        />

        {/* Category selector */}
        <div className="flex flex-col">
          <label
            style={{
              fontSize: "13px",
              lineHeight: "18px",
              letterSpacing: "0.1px",
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-4)",
            }}
          >
            Category
          </label>
          <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setValue("category", cat, { shouldValidate: true })}
                style={{
                  padding: "var(--space-8) var(--space-16)",
                  borderRadius: "var(--radius-sm)",
                  border: `1.5px solid ${selectedCategory === cat ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: selectedCategory === cat ? "var(--color-primary-light)" : "var(--color-surface)",
                  color: selectedCategory === cat ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 150ms ease-out",
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          {errors.category && (
            <p style={{ fontSize: "13px", color: "var(--color-error)", marginTop: "var(--space-4)" }}>
              {errors.category.message}
            </p>
          )}
        </div>

        {/* Duration & Price */}
        <div style={{ display: "flex", gap: "var(--space-16)" }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Duration (min)"
              type="number"
              inputMode="decimal"
              {...register("durationMinutes", { valueAsNumber: true })}
              error={errors.durationMinutes?.message}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Price (KES)"
              type="number"
              inputMode="decimal"
              {...register("priceKes", { valueAsNumber: true })}
              error={errors.priceKes?.message}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-8)" }}>
          <Button type="submit" loading={isPending}>
            {isEditing ? "Save Changes" : "Add Service"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
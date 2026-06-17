/**
 * §3.3 Hours Settings
 *
 * Day-of-week toggles with open/close time pickers.
 * Uses the BusinessHours API.
 */
import { useState, useEffect } from "react";
import { useBusinessHours, useUpdateBusinessHours } from "../hooks/useBusinessHours";
import type { BusinessHoursEntry } from "../hooks/useBusinessHours";
import { useUiStore } from "@/store/ui.store";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HoursSection() {
  const { data: hours = [], isLoading, error, refetch } = useBusinessHours();
  const updateHours = useUpdateBusinessHours();
  const showToast = useUiStore((s) => s.showToast);

  const [localHours, setLocalHours] = useState<BusinessHoursEntry[]>([]);

  // Sync local state when API data arrives
  useEffect(() => {
    if (hours.length > 0) {
      setLocalHours(hours);
    }
  }, [hours]);

  if (error) return <ErrorState message="Couldn't load business hours." onRetry={refetch} />;

  if (isLoading || localHours.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <Skeleton shape="text" width="100%" height="24px" />
          </Card>
        ))}
      </div>
    );
  }

  const updateEntry = (dayOfWeek: number, field: "openTime" | "closeTime" | "isActive", value: string | boolean) => {
    setLocalHours((prev) =>
      prev.map((h) =>
        h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h,
      ),
    );
  };

  const handleSave = () => {
    updateHours.mutate(localHours, {
      onSuccess: () => {
        showToast({ type: "success", message: "Hours updated." });
      },
      onError: () => {
        showToast({ type: "error", message: "Failed to update hours." });
      },
    });
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {localHours
          .sort((a, b) => {
            // Sort Mon–Sun order: 1,2,3,4,5,6,0
            const dayOrder = [1, 2, 3, 4, 5, 6, 0];
            return dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
          })
          .map((entry) => (
            <Card key={entry.dayOfWeek}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
                  {/* Toggle */}
                  <button
                    role="switch"
                    aria-checked={entry.isActive}
                    aria-label={`Toggle ${DAY_LABELS[entry.dayOfWeek]}`}
                    onClick={() => updateEntry(entry.dayOfWeek, "isActive", !entry.isActive)}
                    style={{
                      width: 51,
                      height: 31,
                      borderRadius: "var(--radius-full)",
                      border: "none",
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 200ms ease-out",
                      background: entry.isActive ? "var(--color-primary)" : "var(--color-border-strong)",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: entry.isActive ? 22 : 2,
                        width: 27,
                        height: 27,
                        borderRadius: "var(--radius-full)",
                        background: "white",
                        transition: "left 200ms ease-out",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      }}
                    />
                  </button>

                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      width: 36,
                    }}
                  >
                    {DAY_LABELS[entry.dayOfWeek]}
                  </span>
                </div>

                {entry.isActive ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                    <input
                      type="time"
                      value={entry.openTime}
                      onChange={(e) => updateEntry(entry.dayOfWeek, "openTime", e.target.value)}
                      aria-label={`Open time for ${DAY_LABELS[entry.dayOfWeek]}`}
                      style={{
                        height: 36,
                        padding: "0 var(--space-8)",
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "14px",
                        color: "var(--color-text-primary)",
                      }}
                    />
                    <span style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>–</span>
                    <input
                      type="time"
                      value={entry.closeTime}
                      onChange={(e) => updateEntry(entry.dayOfWeek, "closeTime", e.target.value)}
                      aria-label={`Close time for ${DAY_LABELS[entry.dayOfWeek]}`}
                      style={{
                        height: 36,
                        padding: "0 var(--space-8)",
                        background: "var(--color-surface-raised)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "14px",
                        color: "var(--color-text-primary)",
                      }}
                    />
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: "14px",
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    Closed
                  </span>
                )}
              </div>
            </Card>
          ))}
      </div>

      <div style={{ marginTop: "var(--space-16)" }}>
        <Button loading={updateHours.isPending} onClick={handleSave}>
          Save Hours
        </Button>
      </div>
    </>
  );
}
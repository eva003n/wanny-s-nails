/**
 * §3.3 WhatsApp Settings (read-only config display)
 */
import Card from "@/components/ui/Card";

export default function WhatsAppSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
      <Card>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
            WhatsApp Business
          </p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "var(--space-4) 0 0" }}>
            Configured for sending booking confirmations and reminders to customers.
          </p>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Template status
          </p>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--color-success)",
              background: "var(--color-success-bg)",
              padding: "var(--space-4) var(--space-8)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            Approved
          </span>
        </div>
      </Card>
    </div>
  );
}
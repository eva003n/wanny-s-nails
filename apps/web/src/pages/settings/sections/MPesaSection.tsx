/**
 * §3.3 M-Pesa Settings (read-only shortcode display)
 */
import Card from "@/components/ui/Card";

export default function MPesaSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
      <Card>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
            M-Pesa (Daraja)
          </p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "var(--space-4) 0 0" }}>
            Used for STK Push payments from customers.
          </p>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Shortcode
          </p>
          <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0, fontVariantNumeric: "tabular-nums" }}>
            {import.meta.env.VITE_MPESA_SHORTCODE ?? "••••••"}
          </p>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Environment
          </p>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--color-info)",
              background: "var(--color-info-bg)",
              padding: "var(--space-4) var(--space-8)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {import.meta.env.PROD ? "Production" : "Sandbox"}
          </span>
        </div>
      </Card>
    </div>
  );
}
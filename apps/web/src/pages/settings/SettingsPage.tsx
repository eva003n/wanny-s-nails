/**
 * Settings Page — §6.1 §3.3 UI/UX Spec
 *
 * Grouped list rendered as <section> blocks with headings:
 * 1. Business — name, address, phone, logo upload
 * 2. Hours — day-of-week toggles with open/close time pickers
 * 3. Services — CRUD list, drag-to-reorder, grouped by categories
 * 4. Reminders — toggles for 24h / 1h, editable message preview
 * 5. WhatsApp — read-only config display, template approval status
 * 6. M-Pesa — read-only shortcode
 * 7. Account — change password, logout
 */
import PageHeader from "@/components/layout/PageHeader";
import BusinessSection from "./sections/BusinessSection";
import HoursSection from "./sections/HoursSection";
import ServicesSection from "./sections/ServicesSection";
import RemindersSection from "./sections/RemindersSection";
import WhatsAppSection from "./sections/WhatsAppSection";
import MPesaSection from "./sections/MPesaSection";
import AccountSection from "./sections/AccountSection";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section style={{ marginBottom: "var(--space-32)" }}>
      <h2
        style={{
          fontSize: "13px",
          lineHeight: "18px",
          letterSpacing: "0.6px",
          fontWeight: 500,
          textTransform: "uppercase",
          color: "var(--color-text-secondary)",
          marginBottom: "var(--space-12)",
          paddingLeft: "var(--space-16)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" showBack={false} />

      <div style={{ padding: "var(--space-16)" }}>
        <Section title="Business">
          <BusinessSection />
        </Section>

        <Section title="Hours">
          <HoursSection />
        </Section>

        <Section title="Services">
          <ServicesSection />
        </Section>

        <Section title="Reminders">
          <RemindersSection />
        </Section>

        <Section title="WhatsApp">
          <WhatsAppSection />
        </Section>

        <Section title="M-Pesa">
          <MPesaSection />
        </Section>

        <Section title="Account">
          <AccountSection />
        </Section>
      </div>
    </div>
  );
}
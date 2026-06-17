/**
 * §3.3 Reminders Settings
 *
 * Toggle switches for 24h and 1h reminders with message preview.
 * Uses localStorage for now (no backend model for reminder settings).
 */
import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";

const REMINDER_KEY = "wannysnails:reminderSettings";

interface ReminderSettings {
  reminder24h: boolean;
  reminder1h: boolean;
  message24h: string;
  message1h: string;
}

const DEFAULTS: ReminderSettings = {
  reminder24h: true,
  reminder1h: true,
  message24h: "Hi {name}! This is a reminder about your appointment tomorrow at {time} — {service} at Wanny's Nails. See you soon! 💅",
  message1h: "Hi {name}! Your {service} appointment at Wanny's Nails starts in 1 hour at {time}. See you soon! 💅",
};

function loadSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    return raw ? JSON.parse(raw) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: ReminderSettings) {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(s));
}

export default function RemindersSection() {
  const [settings, setSettings] = useState<ReminderSettings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const toggle = (field: "reminder24h" | "reminder1h") => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
      {/* 24h Reminder */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-8)" }}>
          <div>
            <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
              24-hour reminder
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "var(--space-4) 0 0" }}>
              Send via WhatsApp the day before
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings.reminder24h}
            aria-label="Toggle 24-hour reminder"
            onClick={() => toggle("reminder24h")}
            style={{
              width: 51,
              height: 31,
              borderRadius: "var(--radius-full)",
              border: "none",
              cursor: "pointer",
              position: "relative",
              transition: "background 200ms ease-out",
              background: settings.reminder24h ? "var(--color-primary)" : "var(--color-border-strong)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: settings.reminder24h ? 22 : 2,
                width: 27,
                height: 27,
                borderRadius: "var(--radius-full)",
                background: "white",
                transition: "left 200ms ease-out",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
          </button>
        </div>
        {settings.reminder24h && (
          <p
            style={{
              fontSize: "13px",
              lineHeight: "18px",
              color: "var(--color-text-secondary)",
              background: "var(--color-surface-raised)",
              padding: "var(--space-12)",
              borderRadius: "var(--radius-sm)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            {settings.message24h}
          </p>
        )}
      </Card>

      {/* 1h Reminder */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-8)" }}>
          <div>
            <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
              1-hour reminder
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "var(--space-4) 0 0" }}>
              Send via WhatsApp 1 hour before
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings.reminder1h}
            aria-label="Toggle 1-hour reminder"
            onClick={() => toggle("reminder1h")}
            style={{
              width: 51,
              height: 31,
              borderRadius: "var(--radius-full)",
              border: "none",
              cursor: "pointer",
              position: "relative",
              transition: "background 200ms ease-out",
              background: settings.reminder1h ? "var(--color-primary)" : "var(--color-border-strong)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: settings.reminder1h ? 22 : 2,
                width: 27,
                height: 27,
                borderRadius: "var(--radius-full)",
                background: "white",
                transition: "left 200ms ease-out",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
          </button>
        </div>
        {settings.reminder1h && (
          <p
            style={{
              fontSize: "13px",
              lineHeight: "18px",
              color: "var(--color-text-secondary)",
              background: "var(--color-surface-raised)",
              padding: "var(--space-12)",
              borderRadius: "var(--radius-sm)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            {settings.message1h}
          </p>
        )}
      </Card>
    </div>
  );
}
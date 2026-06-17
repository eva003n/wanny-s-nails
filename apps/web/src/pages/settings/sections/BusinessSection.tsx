/**
 * §3.3 Business Profile Settings
 *
 * Shows salon name and email. Editable name.
 * Phone, address, logo — placeholder "coming soon" for now.
 */
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function BusinessSection() {
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
      <Card>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
            <Input
              label="Salon name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={user?.email ?? ""}
              disabled
            />
            <div style={{ display: "flex", gap: "var(--space-8)" }}>
              <Button
                onClick={() => {
                  // TODO: PATCH /auth/me with name
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button variant="secondary" onClick={() => { setEditing(false); setName(user?.name ?? ""); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
                {user?.name}
              </p>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "var(--space-4) 0 0" }}>
                {user?.email}
              </p>
            </div>
            <button
              onClick={() => setEditing(true)}
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
          </div>
        )}
      </Card>

      {/* Phone placeholder */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
              Phone
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-tertiary)", margin: "var(--space-4) 0 0" }}>
              Coming soon
            </p>
          </div>
        </div>
      </Card>

      {/* Address placeholder */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
              Address
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-tertiary)", margin: "var(--space-4) 0 0" }}>
              Coming soon
            </p>
          </div>
        </div>
      </Card>

      {/* Logo placeholder */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
              Logo
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-tertiary)", margin: "var(--space-4) 0 0" }}>
              Coming soon
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
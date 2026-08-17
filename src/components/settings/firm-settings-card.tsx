"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/form-field";
import { CheckCircle } from "lucide-react";

/**
 * Lets an admin rename the firm across the whole app (login page, sidebar)
 * without touching env vars or redeploying. Backed by the FirmSettings
 * singleton row via /api/settings/firm — see that route for the
 * admin-only PATCH gate (also enforced server-side, not just by hiding
 * this card from non-admins).
 */
export function FirmSettingsCard() {
  const [firmName, setFirmName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/firm")
      .then(res => res.json())
      .then(data => setFirmName(data.firmName ?? "Architect Hub"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/firm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setFirmName(data.firmName);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="font-medium text-ink text-[13px] mb-1">Firm settings</div>
      <p className="text-muted text-[11.5px] mb-3">
        This name appears on the login screen and in the sidebar for everyone at the firm.
      </p>
      {loading ? (
        <p className="text-muted text-[12px]">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <Field label="Firm name" required>
            <Input required value={firmName} onChange={e => setFirmName(e.target.value)} maxLength={80} />
          </Field>
          {error && <p className="text-brick text-[12px]">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-1 border-t border-line">
            {saved && <span className="flex items-center gap-1 text-moss text-[12px]"><CheckCircle size={13} />Saved</span>}
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Field, FormRow } from "@/components/ui/form-field";
import { CheckCircle } from "lucide-react";

interface FirmProfile {
  firmName: string;
  country: string;
  currency: string;
  timezone: string;
}

const EMPTY: FirmProfile = { firmName: "", country: "", currency: "", timezone: "" };

/**
 * Lets an admin edit the firm's real profile — name, country, currency,
 * timezone — across the whole app (login page, sidebar, settings) without
 * touching env vars or redeploying. Backed by the FirmSettings singleton
 * row via /api/settings/firm — see that route for the admin-only PATCH
 * gate (also enforced server-side, not just by hiding this card from
 * non-admins).
 */
export function FirmSettingsCard() {
  const [profile, setProfile] = useState<FirmProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/firm")
      .then(res => res.json())
      .then(data => setProfile({
        firmName: data.firmName ?? "Architect Hub",
        country: data.country ?? "Kenya",
        currency: data.currency ?? "KES",
        timezone: data.timezone ?? "Africa/Nairobi",
      }))
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
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setProfile(data);
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
        This appears on the login screen, the sidebar, and everywhere dates/amounts are shown for everyone at the firm.
      </p>
      {loading ? (
        <p className="text-muted text-[12px]">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <Field label="Firm name" required>
            <Input required value={profile.firmName} onChange={e => setProfile(p => ({ ...p, firmName: e.target.value }))} maxLength={80} />
          </Field>
          <FormRow>
            <Field label="Country" required>
              <Input required value={profile.country} onChange={e => setProfile(p => ({ ...p, country: e.target.value }))} maxLength={80} />
            </Field>
            <Field label="Currency code" required>
              <Input required value={profile.currency} onChange={e => setProfile(p => ({ ...p, currency: e.target.value.toUpperCase() }))} maxLength={10} className="font-mono" />
            </Field>
          </FormRow>
          <Field label="Timezone" required>
            <Input required value={profile.timezone} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))} maxLength={80} placeholder="Africa/Nairobi" />
          </Field>
          {error && <p className="text-brick text-[12px]">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-1 border-t border-line">
            {saved && <span className="flex items-center gap-1 text-moss text-[12px]"><CheckCircle size={13} />Saved</span>}
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-md text-[12.5px] bg-ink-solid text-white font-medium disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

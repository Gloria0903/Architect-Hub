"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input, Field, FormRow } from "@/components/ui/form-field";
import { useStore, roleLabel, Role } from "@/store/app-store";
import { CheckCircle, Camera, Trash2 } from "lucide-react";
import { MfaSettingsCard } from "@/components/settings/mfa-card";
import { FirmSettingsCard } from "@/components/settings/firm-settings-card";
import { SecurityAccessCard } from "@/components/settings/security-access-card";
import { Avatar } from "@/components/ui/avatar";
import { notifyFilePickerOpening } from "@/lib/file-picker-guard";

interface FirmProfile {
  firmName: string;
  country: string;
  currency: string;
  timezone: string;
}

const NOTIFICATION_TOGGLES: {
  key: "notifyLogReminder" | "notifyProjectDelay" | "notifyClientComment" | "notifyWeeklySummary";
  label: string;
}[] = [
  { key: "notifyLogReminder", label: "Email reminder when daily log is not submitted by 5:00pm" },
  { key: "notifyProjectDelay", label: "Email alert when a project becomes delayed" },
  { key: "notifyClientComment", label: "In-app notification on new client comment" },
  { key: "notifyWeeklySummary", label: "Email summary every Monday morning" },
];

type NotificationPrefs = Record<typeof NOTIFICATION_TOGGLES[number]["key"], boolean>;

export default function SettingsPage() {
  const { staff, updateStaff, uploadAvatar, removeAvatar } = useStore();
  const { data: session, update } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const me = staff.find(s => s.id === session?.user?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [form, setForm] = useState({ name: me?.name ?? session?.user?.name ?? "", phone: me?.phone ?? "", password: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Firm profile â€” real data (was hardcoded "Architect Hub Demo Firm" etc.)
  const [firm, setFirm] = useState<FirmProfile | null>(null);

  useEffect(() => {
    fetch("/api/settings/firm")
      .then(res => res.json())
      .then(setFirm)
      .catch(() => setFirm(null));
  }, []);

  // Notification preferences â€” real, persisted per user (were non-functional placeholders)
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [prefsSaving, setPrefsSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/notifications")
      .then(res => (res.ok ? res.json() : null))
      .then(data => data && setPrefs(data))
      .catch(() => {});
  }, []);

  const togglePref = useCallback(async (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setPrefsSaving(key);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setPrefs(prefs);
    } finally {
      setPrefsSaving(null);
    }
  }, [prefs]);

  function openFilePicker() {
    // See src/lib/file-picker-guard.ts â€” prevents AppProvider's window-focus
    // refresh from wiping the selected file when the OS dialog closes.
    notifyFilePickerOpening();
    fileInputRef.current?.click();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setAvatarError("");
    setAvatarBusy(true);
    try {
      await uploadAvatar(file);
      await update?.();
    } catch (err) {
      setAvatarError((err as Error).message || "Failed to upload photo");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarError("");
    setAvatarBusy(true);
    try {
      await removeAvatar();
      await update?.();
    } catch (err) {
      setAvatarError((err as Error).message || "Failed to remove photo");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;
    setError("");
    try {
      const { password, ...rest } = form;
      await updateStaff(session.user.id, { ...rest, ...(password ? { password } : {}) });
      await update?.(); // refresh session name/initials if changed
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message || "Failed to save changes");
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="font-display font-bold text-[20px] text-ink mb-0.5">Settings</h1>
        <p className="text-muted text-[12px] mb-5">Firm configuration and your profile</p>

        <div className="flex flex-col gap-3">
          {!isAdmin && (
            <Card className="p-4">
              <div className="font-medium text-ink text-[13px] mb-3">Firm profile</div>
              {firm ? (
                <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                  <div><div className="text-muted mb-1">Firm name</div><div className="text-ink">{firm.firmName}</div></div>
                  <div><div className="text-muted mb-1">Country</div><div className="text-ink">{firm.country}</div></div>
                  <div><div className="text-muted mb-1">Currency</div><div className="text-ink font-mono">{firm.currency}</div></div>
                  <div><div className="text-muted mb-1">Timezone</div><div className="text-ink">{firm.timezone}</div></div>
                </div>
              ) : (
                <p className="text-muted text-[12px]">Loadingâ€¦</p>
              )}
              <p className="text-muted text-[11px] mt-3">Only an admin can change these â€” see your firm admin to update them.</p>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Avatar avatarUrl={me?.avatarUrl} initials={session?.user?.initials ?? "?"} name={session?.user?.name ?? undefined} size={56} fontSize={18} />
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={avatarBusy}
                  title="Upload photo"
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center border-2 border-surface disabled:opacity-50"
                >
                  <Camera size={12} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <div className="text-ink font-medium">{session?.user?.name}</div>
                <div className="text-muted text-[12px]">{session?.user?.email} Â· {session?.user?.role ? roleLabel(session.user.role as Role) : ""}</div>
                {me?.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleAvatarRemove}
                    disabled={avatarBusy}
                    className="flex items-center gap-1 text-brick text-[11px] mt-1 disabled:opacity-50"
                  >
                    <Trash2 size={11} />Remove photo
                  </button>
                )}
                {avatarError && <p className="text-brick text-[11px] mt-1">{avatarError}</p>}
              </div>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-3.5">
              <FormRow>
                <Field label="Full name"><Input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></Field>
                <Field label="Phone"><Input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="+254 7XX XXX XXX" /></Field>
              </FormRow>
              <Field label="New password"><Input type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder="Leave blank to keep current password" /></Field>
              <p className="text-[11px] text-muted -mt-2">Email and role can only be changed by an admin.</p>
              {error && <p className="text-brick text-[12px]">{error}</p>}
              <div className="flex items-center justify-end gap-3 pt-1 border-t border-line">
                {saved && <span className="flex items-center gap-1 text-moss text-[12px]"><CheckCircle size={13} />Saved</span>}
                <button type="submit" className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium">Save changes</button>
              </div>
            </form>
          </Card>

          <MfaSettingsCard />

          {isAdmin && <FirmSettingsCard />}

          {isAdmin && <SecurityAccessCard />}

          <Card className="p-4">
            <div className="font-medium text-ink text-[13px] mb-3">Notifications</div>
            {prefs ? (
              <div className="flex flex-col gap-2.5 text-[12.5px]">
                {NOTIFICATION_TOGGLES.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-ink">{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs[key]}
                      disabled={prefsSaving === key}
                      onClick={() => togglePref(key)}
                      className={`w-8 h-4 rounded-full relative cursor-pointer shrink-0 ml-3 transition-colors disabled:opacity-50 ${prefs[key] ? "bg-moss" : "bg-line"}`}
                    >
                      <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${prefs[key] ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-[12px]">Loadingâ€¦</p>
            )}
            <p className="text-muted text-[11px] mt-3">These control which emails and in-app notifications you receive. Changes save immediately.</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

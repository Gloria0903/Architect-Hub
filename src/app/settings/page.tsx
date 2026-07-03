"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Field, Input, Button, ErrorBanner, SuccessBanner, Spinner } from "@/components/ui/form";
import { auth, users as usersApi, User, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useAuth";
import { Shield, Key, User as UserIcon } from "lucide-react";

export default function SettingsPage() {
  const { user: authUser, loading } = useRequireAuth();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (authUser) {
      usersApi.get(authUser.id).then(setUser).catch(() => {});
    }
  }, [authUser]);

  if (loading || !user) return <AppShell><Spinner /></AppShell>;

  return (
    <AppShell>
      <Topbar title="Settings" subtitle="Your account and security preferences" />

      <div className="max-w-2xl flex flex-col gap-4">
        <ProfileSection user={user} onUpdated={setUser} />
        <PasswordSection />
        <MfaSection user={user} onUpdated={setUser} />
      </div>
    </AppShell>
  );
}

function ProfileSection({ user, onUpdated }: { user: User; onUpdated: (u: User) => void }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(false);
    try {
      const updated = await usersApi.update(user.id, { firstName, lastName, phone: phone || undefined });
      onUpdated(updated);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update profile.");
    } finally { setSaving(false); }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4 text-[13px] font-medium text-ink">
        <UserIcon size={15} className="text-blueprint" /> Profile
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={user.email} disabled className="opacity-60 cursor-not-allowed" />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7xx xxx xxx" />
        </Field>
      </div>
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
      {success && <div className="mb-3"><SuccessBanner message="Profile updated." /></div>}
      <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
    </Card>
  );
}

function PasswordSection() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!email) { setError("Enter your email address."); return; }
    setSaving(true); setError(null);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send reset link.");
    } finally { setSaving(false); }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4 text-[13px] font-medium text-ink">
        <Key size={15} className="text-blueprint" /> Change password
      </div>
      {sent ? (
        <SuccessBanner message="Password reset link sent. Check your email." />
      ) : (
        <>
          <p className="text-[12.5px] text-muted mb-3">
            We&apos;ll send a secure password reset link to your registered email.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1"
            />
            <Button onClick={handleReset} disabled={saving}>
              {saving ? "Sending…" : "Send reset link"}
            </Button>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        </>
      )}
    </Card>
  );
}

function MfaSection({ user, onUpdated }: { user: User; onUpdated: (u: User) => void }) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSetup() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/auth/mfa/setup`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      setQrCode(data.qrCodeDataUrl);
      setManualKey(data.manualEntryKey);
    } catch {
      setError("Could not start MFA setup.");
    } finally { setLoading(false); }
  }

  async function handleEnable() {
    if (!code) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/auth/mfa/enable`,
        { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setBackupCodes(data.backupCodes);
      onUpdated({ ...user, mfaEnabled: true });
    } catch (e) {
      setError((e as Error).message ?? "Incorrect code.");
    } finally { setLoading(false); }
  }

  async function handleDisable() {
    if (!confirm("Disable two-factor authentication? Your account will be less secure.")) return;
    setLoading(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/auth/mfa/disable`,
        { method: "POST", credentials: "include" },
      );
      onUpdated({ ...user, mfaEnabled: false });
      setQrCode(null);
    } finally { setLoading(false); }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1 text-[13px] font-medium text-ink">
        <Shield size={15} className="text-blueprint" /> Two-factor authentication
      </div>
      <p className="text-[12px] text-muted mb-4">
        {user.mfaEnabled
          ? "MFA is enabled. Your account requires a TOTP code at every login."
          : "Add an extra layer of security to your account."}
      </p>

      {backupCodes ? (
        <div>
          <div className="text-[12.5px] font-medium text-ink mb-2">Save your backup codes</div>
          <div className="grid grid-cols-2 gap-1.5 bg-vellum rounded-md p-3 font-mono text-[12px] mb-3">
            {backupCodes.map((c) => <div key={c} className="text-ink">{c}</div>)}
          </div>
          <p className="text-[11.5px] text-muted">These codes won&apos;t be shown again. Store them somewhere safe.</p>
        </div>
      ) : user.mfaEnabled ? (
        <Button variant="danger" onClick={handleDisable} disabled={loading}>
          {loading ? "Disabling…" : "Disable MFA"}
        </Button>
      ) : qrCode ? (
        <div>
          <p className="text-[12px] text-muted mb-3">Scan with Google Authenticator, 1Password, or Authy.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="MFA QR code" className="w-40 h-40 mb-2" />
          {manualKey && (
            <p className="text-[11px] text-muted font-mono mb-3 break-all">Manual key: {manualKey}</p>
          )}
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="w-40" />
            <Button onClick={handleEnable} disabled={loading}>{loading ? "Verifying…" : "Enable"}</Button>
          </div>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        </div>
      ) : (
        <Button variant="secondary" onClick={handleSetup} disabled={loading}>
          <Shield size={13} /> {loading ? "Loading…" : "Set up MFA"}
        </Button>
      )}
      {error && !qrCode && <div className="mt-3"><ErrorBanner message={error} /></div>}
    </Card>
  );
}

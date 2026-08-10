"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input, Field, FormRow } from "@/components/ui/form-field";
import { useStore, roleLabel, Role } from "@/store/app-store";
import { CheckCircle } from "lucide-react";
import { MfaSettingsCard } from "@/components/settings/mfa-card";

export default function SettingsPage() {
  const { staff, updateStaff } = useStore();
  const { data: session, update } = useSession();
  const me = staff.find(s => s.id === session?.user?.id);

  const [form, setForm] = useState({ name: me?.name ?? session?.user?.name ?? "", phone: me?.phone ?? "", password: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
          <Card className="p-4">
            <div className="font-medium text-ink text-[13px] mb-3">Firm profile</div>
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div><div className="text-muted mb-1">Firm name</div><div className="text-ink">Architect Hub Demo Firm</div></div>
              <div><div className="text-muted mb-1">Country</div><div className="text-ink">Kenya</div></div>
              <div><div className="text-muted mb-1">Currency</div><div className="text-ink font-mono">KES (Kenyan Shilling)</div></div>
              <div><div className="text-muted mb-1">Timezone</div><div className="text-ink">Africa/Nairobi (EAT)</div></div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blueprint-bg text-blueprint font-semibold flex items-center justify-center">
                {session?.user?.initials ?? "?"}
              </div>
              <div>
                <div className="text-ink font-medium">{session?.user?.name}</div>
                <div className="text-muted text-[12px]">{session?.user?.email} · {session?.user?.role ? roleLabel(session.user.role as Role) : ""}</div>
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

          <Card className="p-4">
            <div className="font-medium text-ink text-[13px] mb-3">Notifications</div>
            <div className="flex flex-col gap-2.5 text-[12.5px]">
              {[
                "Email reminder when daily log is not submitted by 5:00pm",
                "Email alert when a project becomes delayed",
                "In-app notification on new client comment",
                "Email summary every Monday morning",
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-ink">{n}</span>
                  <div className="w-8 h-4 bg-moss rounded-full relative cursor-pointer shrink-0 ml-3">
                    <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-muted text-[11px] mt-3">Email delivery isn&apos;t wired up yet — these toggles are placeholders for the notification preferences that will control it.</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
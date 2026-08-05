"use client";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { useStore, roleLabel } from "@/store/app-store";

export default function SettingsPage() {
  const { staff } = useStore();
  const admin = staff.find(s => s.role === "admin");

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="font-display font-bold text-[20px] text-ink mb-0.5">Settings</h1>
        <p className="text-muted text-[12px] mb-5">Firm configuration and system preferences</p>

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
            <div className="font-medium text-ink text-[13px] mb-3">Logged in as</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blueprint-bg text-blueprint font-semibold flex items-center justify-center">{admin?.initials}</div>
              <div>
                <div className="text-ink font-medium">{admin?.name}</div>
                <div className="text-muted text-[12px]">{admin?.email} · {roleLabel(admin?.role ?? "admin")}</div>
              </div>
            </div>
          </Card>

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
          </Card>

          <Card className="p-4">
            <div className="font-medium text-ink text-[13px] mb-1">Phase B coming next</div>
            <p className="text-muted text-[12.5px] leading-relaxed">Database, authentication (MFA), real file uploads (AWS S3), email notifications via BullMQ, and full RBAC per role — all wired in Phase B of the build.</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

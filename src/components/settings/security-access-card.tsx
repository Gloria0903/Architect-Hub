"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useStore } from "@/store/app-store";
import { ShieldCheck, ShieldAlert, CheckCircle } from "lucide-react";

/**
 * Firm-wide security controls, admin only.
 *
 * "Require MFA for all staff" is intentionally a VISIBILITY + POLICY toggle,
 * not a hard login-time block: enforcing it at the login/middleware layer
 * would mean querying firm settings and MFA status on every request (or
 * threading it through the JWT), which is a bigger, riskier change to the
 * auth flow than this pass should take on. Turning it on here labels the
 * expectation and shows exactly who's out of compliance so an admin can
 * follow up directly â€” actual login-time enforcement is a good follow-up
 * once this is proven out.
 *
 * Password policy is deliberately NOT exposed as a configurable toggle
 * here â€” it's already a strong fixed default (10+ chars, mixed case,
 * number, symbol; see src/lib/password-policy.ts) enforced server-side
 * everywhere a password is set. Making it admin-adjustable only adds a way
 * to accidentally weaken it.
 *
 * Active-session view/revoke is not implemented: this app uses JWT
 * sessions (no server-side session table â€” see src/lib/auth.ts), so
 * there's nothing to list or revoke without first moving to database
 * sessions, which is a real architectural change, not a settings toggle.
 */
export function SecurityAccessCard() {
  const { staff } = useStore();
  const [requireMfa, setRequireMfa] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/firm")
      .then(res => res.json())
      .then(data => setRequireMfa(Boolean(data.requireMfa)))
      .finally(() => setLoading(false));
  }, []);

  async function toggle() {
    setError("");
    setSaving(true);
    const next = !requireMfa;
    try {
      const res = await fetch("/api/settings/firm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireMfa: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setRequireMfa(Boolean(data.requireMfa));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const activeStaff = staff.filter(s => s.isActive !== false);
  const withoutMfa = activeStaff.filter(s => !s.mfaEnabled);

  return (
    <Card className="p-4">
      <div className="font-medium text-ink text-[13px] mb-1">Security &amp; access</div>
      <p className="text-muted text-[11.5px] mb-3">Firm-wide security policy for all staff accounts.</p>

      {loading ? (
        <p className="text-muted text-[12px]">Loadingâ€¦</p>
      ) : (
        <>
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-ink text-[12.5px]">Require MFA for all staff</div>
              <p className="text-muted text-[11px] mt-0.5">Marks accounts without MFA as out of compliance below. Each person still enrolls themselves from their own Settings page.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={requireMfa}
              disabled={saving}
              onClick={toggle}
              className={`w-8 h-4 rounded-full relative cursor-pointer shrink-0 ml-3 transition-colors disabled:opacity-50 ${requireMfa ? "bg-moss" : "bg-line"}`}
            >
              <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${requireMfa ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>

          {error && <p className="text-brick text-[12px] mt-1">{error}</p>}
          {saved && <span className="flex items-center gap-1 text-moss text-[11.5px] mt-1"><CheckCircle size={12} />Saved</span>}

          {requireMfa && (
            <div className="mt-3 pt-3 border-t border-line">
              {withoutMfa.length === 0 ? (
                <div className="flex items-center gap-1.5 text-moss text-[12px]">
                  <ShieldCheck size={13} />All active staff have MFA enabled.
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 text-ochre text-[12px] mb-1.5">
                    <ShieldAlert size={13} />{withoutMfa.length} active staff member{withoutMfa.length === 1 ? "" : "s"} without MFA:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {withoutMfa.map(s => (
                      <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-[3px] bg-ochre-bg text-ochre font-medium">{s.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

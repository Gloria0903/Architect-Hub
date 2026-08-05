"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const DEMO_ACCOUNTS = [
  { email: "lewa@archub.io", label: "Lewa Mutiso", role: "Admin" },
  { email: "naomi@archub.io", label: "Naomi Otieno", role: "Senior Architect" },
  { email: "samuel@archub.io", label: "Samuel Kamau", role: "Architect" },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("lewa@archub.io");
  const [password, setPassword] = useState("Password123!");
  const [mfaCode, setMfaCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function attemptSignIn(mfaToken = "") {
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email, password,
      mfaCode: mfaToken,
      redirect: false,
    });
    setLoading(false);

    if (!result?.error) {
      router.push(callbackUrl);
      router.refresh();
      return true;
    }

    return false;
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    const ok = await attemptSignIn("");
    if (!ok) {
      // Only show MFA step if it looks like an MFA issue
      // Otherwise stay on credentials and show error
      setError("Invalid email or password. Make sure you have run: npm run db:seed");
    }
  }

  async function handleDemoLogin(demoEmail: string) {
    setLoading(true);
    setError("");
    setEmail(demoEmail);
    const result = await signIn("credentials", {
      email: demoEmail,
      password: "Password123!",
      mfaCode: "",
      redirect: false,
    });
    setLoading(false);
    if (!result?.error) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Demo login failed. Make sure you have run: npm run db:seed");
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    const code = mfaCode.join("");
    const ok = await attemptSignIn(code);
    if (!ok) setError("Invalid MFA code. Try again.");
  }

  function handleMfaInput(val: string, i: number) {
    const next = [...mfaCode];
    next[i] = val.replace(/[^0-9]/g, "").slice(-1);
    setMfaCode(next);
    if (val && i < 5) document.getElementById(`mfa-${i + 1}`)?.focus();
  }

  return (
    <div className="min-h-screen bg-vellum flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] flex flex-col gap-4">

        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-2">
          <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 16 L9 2 L16 16 Z" fill="none" stroke="#2451C4" strokeWidth="1.4" />
            <line x1="2" y1="16" x2="16" y2="16" stroke="#2451C4" strokeWidth="1.4" />
          </svg>
          <span className="font-display font-bold text-[19px] text-ink">Architect Hub</span>
        </div>

        {/* One-click demo logins */}
        <div className="bg-blueprint-bg border border-blueprint/20 rounded-card p-4">
          <p className="text-blueprint text-[12px] font-medium mb-3">
            Quick demo access — click any account to sign in instantly
          </p>
          <div className="flex flex-col gap-2">
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                onClick={() => handleDemoLogin(acc.email)}
                disabled={loading}
                className="flex items-center justify-between bg-white border border-blueprint/20 rounded-md px-3.5 py-2.5 hover:bg-blueprint-bg hover:border-blueprint/40 transition-colors disabled:opacity-50 text-left"
              >
                <div>
                  <div className="text-ink font-medium text-[13px]">{acc.label}</div>
                  <div className="text-muted text-[11px] font-mono">{acc.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-blueprint-bg text-blueprint px-2 py-0.5 rounded-[3px] font-medium">{acc.role}</span>
                  <span className="text-blueprint text-[12px]">→</span>
                </div>
              </button>
            ))}
          </div>
          {loading && (
            <div className="flex items-center gap-2 mt-3 text-blueprint text-[12px]">
              <div className="w-3 h-3 border-2 border-blueprint border-t-transparent rounded-full animate-spin" />
              Signing in…
            </div>
          )}
          {error && <p className="text-brick text-[12px] mt-2">{error}</p>}
        </div>

        {/* Manual login form */}
        <div className="bg-surface border border-line rounded-card p-5">
          <div className="text-[12px] text-muted font-medium mb-3">Or sign in manually</div>

          {step === "credentials" ? (
            <form onSubmit={handleCredentials} className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] text-muted block mb-1.5">Email</label>
                <input type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint bg-white" />
              </div>
              <div>
                <label className="text-[12px] text-muted block mb-1.5">Password</label>
                <input type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint bg-white" />
              </div>
              {error && <p className="text-brick text-[12px]">{error}</p>}
              <button type="submit" disabled={loading}
                className="bg-ink text-white rounded-md py-2 text-[13px] font-medium hover:bg-ink/90 disabled:opacity-60">
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <button type="button" onClick={() => setStep("mfa")}
                className="text-muted text-[11.5px] text-center">
                I have an MFA code →
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="flex flex-col gap-3">
              <p className="text-muted text-[12px]">Enter your 6-digit authenticator code.</p>
              <div className="flex gap-2">
                {mfaCode.map((digit, i) => (
                  <input key={i} id={`mfa-${i}`} maxLength={1} value={digit}
                    onChange={e => handleMfaInput(e.target.value, i)}
                    className="w-full aspect-square text-center border border-line rounded-md text-[16px] font-mono outline-none focus:border-blueprint bg-white" />
                ))}
              </div>
              {error && <p className="text-brick text-[12px]">{error}</p>}
              <button type="submit" disabled={loading}
                className="bg-ink text-white rounded-md py-2 text-[13px] font-medium hover:bg-ink/90 disabled:opacity-60">
                {loading ? "Verifying…" : "Verify and sign in"}
              </button>
              <button type="button" onClick={() => { setStep("credentials"); setError(""); setMfaCode(["","","","","",""]); }}
                className="text-muted text-[11.5px] text-center">
                ← Back
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-muted">
          If demo accounts fail, run <span className="font-mono bg-vellum px-1 rounded">npm run db:seed</span> in your project folder first.
        </p>
      </div>
    </div>
  );
}

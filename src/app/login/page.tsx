"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useFirmName } from "@/lib/use-firm-name";

function LoginContent() {
  const router = useRouter();
  const firmName = useFirmName();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [mfaCode, setMfaCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function attemptSignIn(mfaToken = "") {
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      mfaCode: mfaToken,
      rememberMe: rememberMe ? "true" : "false",
      redirect: false,
    });
    setLoading(false);

    if (!result?.error) {
      router.push(callbackUrl);
      router.refresh();
      return { ok: true as const };
    }

    return { ok: false as const, code: result.error };
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    const result = await attemptSignIn("");
    if (!result.ok) {
      if (result.code === "MFA_REQUIRED") {
        setStep("mfa");
        setError("");
      } else if (result.code === "ACCOUNT_LOCKED") {
        setError("This account is temporarily locked due to repeated failed attempts. Try again later or contact your administrator.");
      } else if (result.code === "ACCOUNT_INACTIVE") {
        setError("This account has been deactivated. Contact your administrator.");
      } else {
        setError("Invalid email or password.");
      }
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    const code = mfaCode.join("");
    const result = await attemptSignIn(code);
    if (!result.ok) setError("Invalid MFA code. Try again.");
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
          <span className="font-display font-bold text-[19px] text-ink">{firmName}</span>
        </div>

        <div className="bg-surface border border-line rounded-card p-5">
          {step === "credentials" ? (
            <form onSubmit={handleCredentials} className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] text-muted block mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint bg-white"
                />
              </div>
              <div>
                <label className="text-[12px] text-muted block mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint bg-white"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[12px] text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-line"
                  />
                  Remember me
                </label>
                <Link href="/forgot-password" className="text-[12px] text-blueprint hover:underline">
                  Forgot password?
                </Link>
              </div>
              {error && <p className="text-brick text-[12px]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-ink text-white rounded-md py-2 text-[13px] font-medium hover:bg-ink/90 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Login"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="flex flex-col gap-3">
              <p className="text-muted text-[12px]">Enter your 6-digit authenticator code.</p>
              <div className="flex gap-2">
                {mfaCode.map((digit, i) => (
                  <input
                    key={i}
                    id={`mfa-${i}`}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleMfaInput(e.target.value, i)}
                    className="w-full aspect-square text-center border border-line rounded-md text-[16px] font-mono outline-none focus:border-blueprint bg-white"
                  />
                ))}
              </div>
              {error && <p className="text-brick text-[12px]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-ink text-white rounded-md py-2 text-[13px] font-medium hover:bg-ink/90 disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify and sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setError("");
                  setMfaCode(["", "", "", "", "", ""]);
                }}
                className="text-muted text-[11.5px] text-center"
              >
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

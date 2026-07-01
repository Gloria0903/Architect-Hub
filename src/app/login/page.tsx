"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [code, setCode] = useState(["", "", "", "", "", ""]);

  function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("mfa");
  }

  function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-vellum flex items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2 justify-center mb-8">
          <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 16 L9 2 L16 16 Z" fill="none" stroke="#2451C4" strokeWidth="1.4" />
            <line x1="2" y1="16" x2="16" y2="16" stroke="#2451C4" strokeWidth="1.4" />
          </svg>
          <span className="font-display font-bold text-[18px] text-ink">Architect Hub</span>
        </div>

        <div className="bg-surface border border-line rounded-card p-7">
          {step === "credentials" ? (
            <>
              <div className="mb-5">
                <h1 className="font-display font-semibold text-[17px] text-ink">Sign in</h1>
                <p className="text-muted text-[12.5px] mt-1">
                  Use your firm email and password to continue.
                </p>
              </div>
              <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="text-[12px] text-muted block mb-1.5">Work email</label>
                  <input
                    type="email"
                    required
                    defaultValue="lewa.mutiso@architecthub.io"
                    placeholder="name@yourfirm.com"
                    className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint focus:ring-1 focus:ring-blueprint bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] text-muted block">Password</label>
                    <a href="#" className="text-[11.5px] text-blueprint">Forgot password?</a>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint focus:ring-1 focus:ring-blueprint bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-ink text-white rounded-md py-2.5 text-[13px] font-medium mt-1.5 hover:bg-ink/90 transition-colors"
                >
                  Continue
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="font-display font-semibold text-[17px] text-ink">Verify it&apos;s you</h1>
                <p className="text-muted text-[12.5px] mt-1">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>
              <form onSubmit={handleMfaSubmit}>
                <div className="flex gap-2 mb-5">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const next = [...code];
                        next[i] = e.target.value.replace(/[^0-9]/g, "");
                        setCode(next);
                      }}
                      className="w-full aspect-square text-center border border-line rounded-md text-[16px] font-mono outline-none focus:border-blueprint focus:ring-1 focus:ring-blueprint bg-white"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="w-full bg-ink text-white rounded-md py-2.5 text-[13px] font-medium hover:bg-ink/90 transition-colors"
                >
                  Verify and sign in
                </button>
                <button
                  type="button"
                  onClick={() => setStep("credentials")}
                  className="w-full text-center text-[12px] text-muted mt-3"
                >
                  ← Back
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-muted mt-5">
          Protected by multi-factor authentication and role-based access control.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-vellum flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-center mb-2">
          <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 16 L9 2 L16 16 Z" fill="none" stroke="#2451C4" strokeWidth="1.4" />
            <line x1="2" y1="16" x2="16" y2="16" stroke="#2451C4" strokeWidth="1.4" />
          </svg>
          <span className="font-display font-bold text-[19px] text-ink">Architect Hub</span>
        </div>

        <div className="bg-surface border border-line rounded-card p-5">
          {submitted ? (
            <div className="flex flex-col gap-3 text-center">
              <p className="text-ink text-[13px] font-medium">Check your email</p>
              <p className="text-muted text-[12px]">
                If an account exists for {email}, we&rsquo;ve sent a link to reset your password. It expires in 1 hour.
              </p>
              <Link href="/login" className="text-blueprint text-[12px] hover:underline">
                ← Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-muted text-[12px]">
                Enter the email associated with your account and we&rsquo;ll send a link to reset your password.
              </p>
              <div>
                <label className="text-[12px] text-muted block mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint bg-surface text-ink"
                />
              </div>
              {error && <p className="text-brick text-[12px]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-ink text-white rounded-md py-2 text-[13px] font-medium hover:bg-ink/90 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <Link href="/login" className="text-muted text-[11.5px] text-center hover:underline">
                ← Back to login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

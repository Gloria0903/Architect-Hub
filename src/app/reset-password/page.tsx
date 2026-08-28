"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-vellum flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] bg-surface border border-line rounded-card p-5 text-center">
          <p className="text-brick text-[13px]">This reset link is missing a token.</p>
          <Link href="/forgot-password" className="text-blueprint text-[12px] hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
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
          {done ? (
            <p className="text-moss text-[13px] text-center">Password updated. Redirecting to login…</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <p className="text-muted text-[12px]">
                Choose a new password (min 10 characters, with upper/lowercase, a number, and a symbol).
              </p>
              <div>
                <label className="text-[12px] text-muted block mb-1.5">New password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint bg-surface text-ink"
                />
              </div>
              <div>
                <label className="text-[12px] text-muted block mb-1.5">Confirm new password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-[13px] outline-none focus:border-blueprint bg-surface text-ink"
                />
              </div>
              {error && <p className="text-brick text-[12px]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-ink text-white rounded-md py-2 text-[13px] font-medium hover:bg-ink/90 disabled:opacity-60"
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";

type Status = "loading" | "enabled" | "disabled";
type Flow = "idle" | "enrolling" | "confirming" | "disabling";

/** Six-box code entry, matching the pattern already used on the login page. */
function CodeInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex gap-2">
      {value.map((digit, i) => (
        <input
          key={i}
          id={`mfa-setup-digit-${i}`}
          value={digit}
          inputMode="numeric"
          maxLength={1}
          className="w-9 h-10 text-center rounded-md border border-line text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-blueprint"
          onChange={(e) => {
            const char = e.target.value.replace(/[^0-9]/g, "").slice(-1);
            const next = [...value];
            next[i] = char;
            onChange(next);
            if (char && i < value.length - 1) {
              document.getElementById(`mfa-setup-digit-${i + 1}`)?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              document.getElementById(`mfa-setup-digit-${i - 1}`)?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}

export function MfaSettingsCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [flow, setFlow] = useState<Flow>("idle");
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/mfa/status")
      .then((res) => res.json())
      .then((data) => setStatus(data.mfaEnabled ? "enabled" : "disabled"))
      .catch(() => setStatus("disabled"));
  }, []);

  const resetFlow = () => {
    setFlow("idle");
    setSecret("");
    setQrDataUrl("");
    setCode(["", "", "", "", "", ""]);
    setError("");
  };

  const startEnroll = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      if (!res.ok) throw new Error("Could not start setup. Please try again.");
      const data = await res.json();
      setSecret(data.secret);
      setQrDataUrl(data.qrDataUrl);
      setFlow("confirming");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code: code.join("") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not verify that code.");
      setStatus("enabled");
      setSuccess("Two-factor authentication is now on.");
      resetFlow();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.join("") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not verify that code.");
      setStatus("disabled");
      setSuccess("Two-factor authentication is now off.");
      resetFlow();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {status === "enabled" ? (
            <ShieldCheck size={16} className="text-moss" />
          ) : (
            <ShieldOff size={16} className="text-muted" />
          )}
          <div className="font-medium text-ink text-[13px]">Two-factor authentication</div>
        </div>
        {status === "loading" && <Loader2 size={14} className="animate-spin text-muted" />}
      </div>

      {success && (
        <p className="flex items-center gap-1 text-moss text-[12px] mb-3">
          <CheckCircle size={13} />
          {success}
        </p>
      )}

      {status !== "loading" && flow === "idle" && (
        <>
          <p className="text-muted text-[12.5px] mb-3">
            {status === "enabled"
              ? "Your account requires a code from your authenticator app at sign-in, in addition to your password."
              : "Add an extra layer of security. Once enabled, you'll need a code from an authenticator app (like Google Authenticator or Authy) to sign in."}
          </p>
          {status === "enabled" ? (
            <button
              onClick={() => setFlow("disabling")}
              className="px-4 py-2 rounded-md text-[12.5px] border border-line text-ink font-medium"
            >
              Turn off two-factor authentication
            </button>
          ) : (
            <button
              onClick={startEnroll}
              disabled={busy}
              className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium disabled:opacity-60"
            >
              {busy ? "Setting up…" : "Set up two-factor authentication"}
            </button>
          )}
        </>
      )}

      {flow === "confirming" && (
        <div className="flex flex-col gap-3.5">
          <p className="text-muted text-[12.5px]">
            Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, not a static asset
            <img src={qrDataUrl} alt="MFA setup QR code" className="w-40 h-40 border border-line rounded-md" />
          )}
          <details className="text-[11.5px] text-muted">
            <summary className="cursor-pointer">Can't scan it? Enter this code manually</summary>
            <code className="block mt-1.5 p-2 bg-paper rounded-md font-mono text-[11px] break-all">{secret}</code>
          </details>
          <div>
            <p className="text-[11px] text-muted mb-1.5">Enter the 6-digit code</p>
            <CodeInput value={code} onChange={setCode} />
          </div>
          {error && <p className="text-brick text-[12px]">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={confirmEnroll}
              disabled={busy || code.join("").length !== 6}
              className="px-4 py-2 rounded-md text-[12.5px] bg-ink text-white font-medium disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Confirm and enable"}
            </button>
            <button onClick={resetFlow} className="px-4 py-2 rounded-md text-[12.5px] text-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {flow === "disabling" && (
        <div className="flex flex-col gap-3.5">
          <p className="text-muted text-[12.5px]">
            Enter a current code from your authenticator app to confirm turning this off.
          </p>
          <CodeInput value={code} onChange={setCode} />
          {error && <p className="text-brick text-[12px]">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={confirmDisable}
              disabled={busy || code.join("").length !== 6}
              className="px-4 py-2 rounded-md text-[12.5px] border border-brick text-brick font-medium disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Turn off"}
            </button>
            <button onClick={resetFlow} className="px-4 py-2 rounded-md text-[12.5px] text-muted">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

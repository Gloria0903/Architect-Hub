"use client";
import { useEffect, useState } from "react";

const DEFAULT_FIRM_NAME = "Architect Hub";

/**
 * Firm branding name, fetched from /api/settings/firm (public GET — see
 * that route and middleware.ts). Used on the login page (unauthenticated)
 * and the sidebar (authenticated), so it's a plain fetch hook rather than
 * routed through the app-store, which assumes an authenticated session.
 * Starts at the default so there's no layout flash/empty state pre-fetch.
 */
export function useFirmName(): string {
  const [firmName, setFirmName] = useState(DEFAULT_FIRM_NAME);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/firm")
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.firmName) setFirmName(data.firmName);
      })
      .catch(() => {
        /* keep default on failure — branding is non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return firmName;
}

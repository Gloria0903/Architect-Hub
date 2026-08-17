import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Login, password reset, and MFA endpoints get a tighter budget — these are
// the classic brute-force / credential-stuffing targets. (Login itself also
// has per-account lockout in src/lib/auth.ts; this is the per-IP layer on
// top of that, so an attacker can't just spray many different accounts.)
const AUTH_SENSITIVE_PREFIXES = [
  "/api/auth/callback/credentials",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/mfa",
];

function isRateLimited(pathname: string, ip: string): { limited: boolean; retryAfterMs: number } {
  const sensitive = AUTH_SENSITIVE_PREFIXES.some((p) => pathname.startsWith(p));
  const { ok, retryAfterMs } = sensitive
    ? rateLimit(`auth:${ip}`, 10, 5 * 60 * 1000) // 10 requests / 5 min per IP
    : rateLimit(`api:${ip}:${pathname}`, 60, 60 * 1000); // 60 requests / min per IP+route
  return { limited: !ok, retryAfterMs };
}

/**
 * Reject cross-site state-changing requests. Session cookies are already
 * SameSite, which covers most of this, but browsers vary in how strictly
 * they enforce that — this is the standard OWASP-recommended second layer
 * for JSON APIs: verify the request actually originated from this app,
 * rather than issuing/checking a separate CSRF token on every form.
 */
function isCrossOriginMutation(req: NextAuthRequest): boolean {
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return false; // no Origin/Referer at all — some proxies strip it; don't block on absence

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true; // unparseable Origin/Referer is itself suspicious
  }

  const allowedHosts = new Set(
    [req.nextUrl.host, process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL]
      .filter((v): v is string => Boolean(v))
      .map((v) => {
        try {
          return new URL(v.includes("://") ? v : `https://${v}`).host;
        } catch {
          return v;
        }
      })
  );

  return !allowedHosts.has(originHost);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const isApiRoute = pathname.startsWith("/api");

  // ── CSRF: block cross-site mutations before anything else runs ──────────
  if (isApiRoute && MUTATING_METHODS.has(method) && isCrossOriginMutation(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  // ── Rate limiting: mutating API calls only — reads (including dashboard
  // polling) are intentionally exempt so this can't throttle normal usage.
  if (isApiRoute && MUTATING_METHODS.has(method)) {
    const ip = getClientIp(req);
    const { limited, retryAfterMs } = isRateLimited(pathname, ip);
    if (limited) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }
  }

  const publicPaths = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/api/auth",
    // Firm branding (name) shown on the unauthenticated login page. GET is
    // unauthenticated by design; PATCH still enforces its own auth + admin
    // check inside the route handler, since this bypasses the session gate.
    "/api/settings/firm",
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (!req.auth && !isPublic) {
    // API routes must NEVER receive an HTML redirect response — fetch() follows
    // redirects transparently, the client would then try to JSON.parse the
    // login page's HTML and blow up with "Unexpected token '<'". Always return
    // JSON for API routes; only redirect real page navigations.
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && pathname === "/login") {
    const home = req.auth.user.role === "CLIENT" ? "/client-portal" : "/dashboard";
    return NextResponse.redirect(new URL(home, req.url));
  }

  // Client Portal and staff app are separate worlds: a client session must
  // never reach staff pages/APIs (client-comms, staff, finance, etc. all
  // expose other clients' data), and a staff session has no business in
  // the portal. Route handlers still re-check this — see
  // src/lib/client-portal-auth.ts — this is defense in depth, not the
  // only gate.
  if (req.auth) {
    const isClient = req.auth.user.role === "CLIENT";
    const isPortalArea = pathname.startsWith("/client-portal") || pathname.startsWith("/api/client-portal");
    if (isClient && !isPortalArea && !isPublic) {
      return isApiRoute
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/client-portal", req.url));
    }
    if (!isClient && isPortalArea) {
      return isApiRoute
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  const res = NextResponse.next();
  // Security headers on every response (defense in depth; see next.config.js
  // for the static/global headers applied at the edge/CDN level too).
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};

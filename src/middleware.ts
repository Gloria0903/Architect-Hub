import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/login", "/forgot-password", "/reset-password", "/api/auth"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  const isApiRoute = pathname.startsWith("/api");

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
    return NextResponse.redirect(new URL("/dashboard", req.url));
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

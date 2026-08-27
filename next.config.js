/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Derived from the same env vars src/lib/s3.ts actually uses, so this
// always matches whatever bucket/region is really configured at deploy
// time -- a hardcoded guess here would silently break every document
// thumbnail and avatar in production the moment it didn't match the
// real bucket, and (like the CSP itself) nothing in dev would ever
// reveal that mismatch since this header is skipped in dev entirely.
const s3ImgSrc =
  process.env.AWS_S3_BUCKET && process.env.AWS_REGION
    ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`
    : ""; // S3 not configured -- falls back to local disk storage, nothing to allowlist

const nextConfig = {
  reactStrictMode: true,
  // "standalone" output is what the Dockerfile (Railway/self-hosted
  // path) needs -- it produces a self-contained server.js with only the
  // dependencies each route actually uses. Vercel has its own packaging
  // system for serverless functions and doesn't want this: combined
  // with Vercel's build, it causes exactly the "Failed to collect page
  // data" error on API routes that touch Prisma. process.env.VERCEL is
  // set automatically by Vercel's build environment, so this correctly
  // targets each platform's own expectations without needing a manual
  // toggle.
  // "standalone" output is what the Dockerfile (Railway/self-hosted
  // path) needs. Vercel doesn't want it (see comment above). Shared
  // hosting environments with a managed Node.js app runner (e.g.
  // HostAfrica's DirectAdmin Node.js Selector) generally expect a plain
  // `next start` too -- standalone mode's server.js needs the static
  // assets and public folder manually copied alongside it (that's what
  // the Dockerfile's explicit COPY steps do), which most managed
  // Node.js hosting panels have no built-in way to do. Set
  // DISABLE_STANDALONE_BUILD=true on that kind of host to get a normal
  // build instead.
  ...(process.env.VERCEL || process.env.DISABLE_STANDALONE_BUILD === "true"
    ? {}
    : { output: "standalone" }),
  experimental: { serverActions: { allowedOrigins: ["localhost:3000"] } },
  async headers() {
    if (!isProd) return []; // don't apply CSP/HSTS in dev — breaks HMR/Fast Refresh

    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' is required here -- Next.js's App Router injects
      // inline hydration scripts (self.__next_f.push(...)) into every
      // page. Without this, a browser enforcing this CSP blocks those
      // scripts and the app fails to hydrate at all -- blank page,
      // nothing interactive. This CSP header only activates in
      // production (see isProd above), so this had never actually been
      // exercised until now; dev mode always skips it.
      //
      // The "correct" alternative is a per-request nonce generated in
      // middleware instead of 'unsafe-inline'. That's deliberately NOT
      // done here: as of this Next.js version, nonce-based CSP is
      // broken specifically for the Turbopack + output:"standalone"
      // combination this app uses -- Next's own injected scripts don't
      // receive the nonce at all, so the app breaks the same way either
      // way. 'unsafe-inline' is also Next.js's own documented
      // recommendation for apps not implementing per-request nonces.
      // Revisit once that upstream bug is fixed.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:" + (s3ImgSrc ? ` ${s3ImgSrc}` : ""),
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
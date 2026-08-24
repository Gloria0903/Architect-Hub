import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Auto-served at /icon by Next.js's file convention -- no manual <link>
 * tag needed, the framework wires it into every page's <head>
 * automatically. Matches the same triangle mark already used in the
 * sidebar logo (src/components/layout/sidebar.tsx) for brand
 * consistency, just filled solid rather than outlined -- a thin
 * stroke doesn't read clearly at 16-32px browser-tab size, a filled
 * shape does.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#13191F", // matches the `ink` design token
          borderRadius: 6,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 18 18">
          <path d="M2 16 L9 2 L16 16 Z" fill="#2451C4" />
        </svg>
      </div>
    ),
    { ...size }
  );
}

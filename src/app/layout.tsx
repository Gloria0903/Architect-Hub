import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { AppProvider } from "@/store/app-store";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Architect Hub",
  description: "Architectural Knowledge Continuity & Project Management Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs before React hydrates and before first paint, so the
          correct theme class is already on <html> by the time anything
          renders -- without this, the page would flash light mode for
          a moment even when the person has dark mode selected, since
          ThemeProvider's own effect only runs after hydration.
          suppressHydrationWarning above is needed because this script
          intentionally makes the server-rendered and client-rendered
          <html> className attributes differ.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem("architect-hub-theme");
                  var isDark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
                  if (isDark) document.documentElement.classList.add("dark");
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <AuthSessionProvider>
            <AppProvider>
              {children}
            </AppProvider>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
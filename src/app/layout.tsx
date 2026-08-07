import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { AppProvider } from "@/store/app-store";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-space-grotesk" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Architect Hub",
  description: "Architectural Knowledge Continuity & Project Management Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} font-sans antialiased`}>
        <AuthSessionProvider>
          <AppProvider>{children}</AppProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

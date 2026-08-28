import { PrismaClient } from "@prisma/client";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

/*
 * Uses Neon's serverless driver instead of a raw Postgres TCP
 * connection -- it communicates over WSS (WebSocket Secure), which
 * rides the same port 443 as ordinary HTTPS traffic. This is what
 * makes the app work on hosting that blocks outbound Postgres ports
 * (5432/6543) entirely, like HostPinnacle's shared hosting -- a raw
 * TCP connection to Postgres would never get through there, but this
 * looks like normal web traffic to any port-based firewall.
 *
 * Used unconditionally (not just on shared hosting) so the connection
 * method is identical across every environment this app runs in --
 * one less thing to differ between local dev, Railway, and shared
 * hosting.
 *
 * `ws` is required here specifically because this runs in a normal
 * Node.js process, not a true edge runtime with a native WebSocket
 * global -- see the Neon serverless driver docs.
 */
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

import IORedis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __archubRedis: IORedis | undefined;
}

/**
 * BullMQ requires a Redis connection with maxRetriesPerRequest: null so it
 * can block on BRPOPLPUSH-style calls without the client giving up early.
 * Reused as a global singleton in dev to survive Next.js hot-reload
 * (otherwise every reload opens a new TCP connection and leaks sockets).
 */
export const redis =
  globalThis.__archubRedis ??
  new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__archubRedis = redis;
}

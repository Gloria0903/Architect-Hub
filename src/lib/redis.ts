import IORedis from "ioredis";

declare global {
   
  var __archubRedis: IORedis | undefined;
  var __archubRedisWarned: boolean | undefined;
}

/**
 * BullMQ requires a Redis connection with maxRetriesPerRequest: null so it
 * can block on BRPOPLPUSH-style calls without the client giving up early.
 * Reused as a global singleton in dev to survive Next.js hot-reload
 * (otherwise every reload opens a new TCP connection and leaks sockets).
 *
 * IMPORTANT: ioredis emits an 'error' event on every failed connection
 * attempt. Without a listener attached, Node treats that as an uncaught
 * exception and crashes the whole process — which would take down the
 * entire app (dashboard, auth, everything) just because Redis isn't
 * provisioned yet. We attach a listener that logs once and otherwise
 * swallows it; callers (enqueueEmail) already fail soft.
 */
export const redisConfigured = Boolean(process.env.REDIS_URL);

export const redis =
  globalThis.__archubRedis ??
  new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    lazyConnect: true, // don't connect until something actually calls it
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)), // give up after a few tries instead of retrying forever
  });

redis.on("error", (err) => {
  if (!globalThis.__archubRedisWarned) {
    globalThis.__archubRedisWarned = true;
     
    console.warn(
      "[redis] Not connected — email notifications and background reminders are disabled until REDIS_URL is set.",
      err.message
    );
  }
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__archubRedis = redis;
}

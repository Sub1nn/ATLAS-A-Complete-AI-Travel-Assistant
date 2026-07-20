import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger.js";

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300);
const chatWindowMs = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const chatMaxRequests = Number(process.env.CHAT_RATE_LIMIT_MAX_REQUESTS || 12);

let redisStoreWarningLogged = false;
let redisClientPromise = null;
const fallbackCounters = new Map();

function clientKey(req) {
  return req.user?._id ? `user:${req.user._id.toString()}` : req.ip;
}

function developmentRateLimitsDisabled() {
  return process.env.NODE_ENV === "development" && process.env.ENFORCE_DEVELOPMENT_LIMITS !== "true";
}

function safeIpKey(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown-ip";
}

async function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (redisClientPromise) return redisClientPromise;

  redisClientPromise = import("redis")
    .then(async ({ createClient }) => {
      const client = createClient({ url: process.env.REDIS_URL });
      client.on("error", (error) => {
        if (!redisStoreWarningLogged) {
          logger.warn("Redis rate-limit store error. Falling back to in-memory counters when available.", { reason: error.message });
          redisStoreWarningLogged = true;
        }
      });
      await client.connect();
      logger.info("Redis rate-limit store connected");
      return client;
    })
    .catch((error) => {
      redisClientPromise = null;
      if (!redisStoreWarningLogged) {
        logger.warn("Redis rate-limit store unavailable. Using express-rate-limit memory store.", { reason: error.message });
        redisStoreWarningLogged = true;
      }
      return null;
    });

  return redisClientPromise;
}

function incrementFallback(key, windowMs) {
  const now = Date.now();
  if (fallbackCounters.size > 10000) {
    for (const [entryKey, entry] of fallbackCounters.entries()) {
      if (entry.resetAt <= now) fallbackCounters.delete(entryKey);
    }
  }
  const existing = fallbackCounters.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    fallbackCounters.set(key, { totalHits: 1, resetAt });
    return { totalHits: 1, resetTime: new Date(resetAt) };
  }
  existing.totalHits += 1;
  return { totalHits: existing.totalHits, resetTime: new Date(existing.resetAt) };
}

class RedisRateLimitStore {
  constructor(prefix = "rate-limit") {
    this.prefix = `atlas:${prefix}:`;
    this.windowMs = 60000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const redis = await getRedisClient();
    if (!redis) return incrementFallback(`${this.prefix}${key}`, this.windowMs);
    const redisKey = `${this.prefix}${key}`;
    const totalHits = await redis.incr(redisKey);
    if (totalHits === 1) await redis.pExpire(redisKey, this.windowMs);
    const ttl = await redis.pTTL(redisKey);
    return {
      totalHits,
      resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)),
    };
  }

  async decrement(key) {
    const redis = await getRedisClient();
    if (redis) await redis.decr(`${this.prefix}${key}`);
  }

  async resetKey(key) {
    const redis = await getRedisClient();
    if (redis) await redis.del(`${this.prefix}${key}`);
    fallbackCounters.delete(`${this.prefix}${key}`);
  }
}

function redisStore(prefix) {
  return process.env.REDIS_URL ? new RedisRateLimitStore(prefix) : undefined;
}

function createLimiter({ prefix, windowMs: limiterWindowMs, max, message, keyGenerator = safeIpKey }) {
  const limiter = rateLimit({
    windowMs: limiterWindowMs,
    max,
    keyGenerator,
    store: redisStore(prefix),
    message: {
      error: "Too many requests",
      message,
      retryAfter: Math.ceil(limiterWindowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn("Rate limit exceeded", { limiter: prefix, userScoped: Boolean(req.user?._id) });
      res.status(429).json({
        error: "Too many requests",
        message,
        retryAfter: Math.ceil(limiterWindowMs / 1000),
      });
    },
  });

  return (req, res, next) => {
    if (developmentRateLimitsDisabled()) return next();
    return limiter(req, res, next);
  };
}

export const rateLimiter = createLimiter({
  prefix: "global",
  windowMs,
  max: maxRequests,
  message: "Rate limit exceeded. Please try again later.",
});

export const authRateLimiter = createLimiter({
  prefix: "auth",
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 20),
  message: "Too many authentication attempts. Please wait and try again.",
});

export const passwordResetRateLimiter = createLimiter({
  prefix: "password-reset",
  windowMs: Number(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000),
  max: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS || 5),
  message: "Too many password reset requests. Please wait before trying again.",
});

export const emailResendRateLimiter = createLimiter({
  prefix: "email-resend",
  windowMs: Number(process.env.EMAIL_RESEND_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.EMAIL_RESEND_RATE_LIMIT_MAX_REQUESTS || 3),
  keyGenerator: clientKey,
  message: "Too many verification email requests. Please wait before trying again.",
});

export const chatRateLimiter = createLimiter({
  prefix: "chat",
  windowMs: chatWindowMs,
  max: chatMaxRequests,
  keyGenerator: clientKey,
  message: "Too many chat messages. Please wait a moment before sending another message.",
});

export const documentUploadRateLimiter = createLimiter({
  prefix: "document-upload",
  windowMs: Number(process.env.DOCUMENT_UPLOAD_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  max: Number(process.env.DOCUMENT_UPLOAD_RATE_LIMIT_MAX_REQUESTS || 10),
  keyGenerator: clientKey,
  message: "Too many document uploads. Please wait before uploading more files.",
});

export async function closeRateLimitStore() {
  const client = redisClientPromise ? await redisClientPromise.catch(() => null) : null;
  if (client?.isOpen) await client.quit();
  redisClientPromise = null;
  fallbackCounters.clear();
}

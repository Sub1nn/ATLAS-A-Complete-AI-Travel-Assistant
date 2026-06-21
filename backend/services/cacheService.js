import crypto from "crypto";
import { logger } from "../utils/logger.js";

const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_DEFAULT_TTL_SECONDS || 300);
const MEMORY_MAX_ITEMS = Number(process.env.CACHE_MEMORY_MAX_ITEMS || 1000);
const REDIS_URL = process.env.REDIS_URL || "";
const memoryCache = new Map();
const inFlight = new Map();
let redisClientPromise = null;
let redisUnavailableLogged = false;
let redisConnected = false;

function shouldUseMemoryFallback() {
  return process.env.NODE_ENV !== "production" && process.env.CACHE_DISABLE_MEMORY !== "true";
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function memoryPrune() {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) memoryCache.delete(key);
  }
  while (memoryCache.size > MEMORY_MAX_ITEMS) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
}

async function getRedisClient() {
  if (!REDIS_URL) return null;
  if (redisClientPromise) return redisClientPromise;

  redisClientPromise = import("redis")
    .then(async ({ createClient }) => {
      const client = createClient({ url: REDIS_URL });
      client.on("error", (error) => {
        redisConnected = false;
        if (!redisUnavailableLogged) {
          logger.warn("Redis cache connection error. Falling back where allowed.", { reason: error.message });
          redisUnavailableLogged = true;
        }
      });
      client.on("ready", () => { redisConnected = true; });
      client.on("end", () => { redisConnected = false; });
      await client.connect();
      redisConnected = true;
      logger.info("Redis cache connected");
      return client;
    })
    .catch((error) => {
      redisClientPromise = null;
      redisConnected = false;
      if (!redisUnavailableLogged) {
        logger.warn("Redis cache unavailable. Cache will use development memory fallback or no-op in production.", { reason: error.message });
        redisUnavailableLogged = true;
      }
      return null;
    });

  return redisClientPromise;
}

export function cacheKey(namespace, payload) {
  return `atlas:${namespace}:${hash(stableStringify(payload))}`;
}

async function readCache(key) {
  const redis = await getRedisClient();
  if (redis) {
    const raw = await redis.get(key);
    return raw === null ? { hit: false, value: null } : { hit: true, value: JSON.parse(raw) };
  }

  if (!shouldUseMemoryFallback()) return { hit: false, value: null };
  memoryPrune();
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return { hit: false, value: null };
  }
  return { hit: true, value: entry.value };
}

export async function getCache(key) {
  return (await readCache(key)).value;
}

export async function setCache(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!ttlSeconds || ttlSeconds <= 0) return;
  const redis = await getRedisClient();
  if (redis) {
    await redis.set(key, JSON.stringify(value), { EX: Math.max(1, Math.floor(ttlSeconds)) });
    return;
  }

  if (!shouldUseMemoryFallback()) return;
  memoryPrune();
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function getOrSetCache(key, ttlSeconds, producer) {
  const cached = await readCache(key);
  if (cached.hit) return { value: cached.value, cached: true };

  if (inFlight.has(key)) return { value: await inFlight.get(key), cached: true };

  const pending = Promise.resolve().then(producer);
  inFlight.set(key, pending);
  try {
    const value = await pending;
    await setCache(key, value, ttlSeconds);
    return { value, cached: false };
  } finally {
    inFlight.delete(key);
  }
}

export function cacheStatus() {
  return {
    redisConfigured: Boolean(REDIS_URL),
    redisConnected,
    memoryFallback: shouldUseMemoryFallback(),
    memoryEntries: memoryCache.size,
  };
}

export async function initializeCache() {
  const client = await getRedisClient();
  if (process.env.REDIS_REQUIRED === "true" && !client) {
    throw new Error("REDIS_REQUIRED=true but Redis is unavailable");
  }
  return Boolean(client);
}

export async function closeCache() {
  const client = redisClientPromise ? await redisClientPromise.catch(() => null) : null;
  if (client?.isOpen) await client.quit();
  redisClientPromise = null;
  redisConnected = false;
  inFlight.clear();
}

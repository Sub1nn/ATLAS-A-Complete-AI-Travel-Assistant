import crypto from "crypto";

const startedAt = new Date();
const counters = new Map();
const durations = new Map();
let redisPromise;

function metricsKey() {
  return `atlas:metrics:${new Date().toISOString().slice(0, 10)}`;
}

async function redisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redisPromise) {
    redisPromise = import("redis").then(async ({ createClient }) => {
      const client = createClient({ url: process.env.REDIS_URL });
      client.on("error", () => {});
      await client.connect();
      return client;
    }).catch(() => null);
  }
  return redisPromise;
}

async function recordDistributed(status, route, elapsed) {
  const redis = await redisClient();
  if (!redis) return;
  const key = metricsKey();
  await redis.multi()
    .hIncrBy(key, "http_requests_total", 1)
    .hIncrBy(key, `http_status_${status}`, 1)
    .hIncrBy(key, `http_${route}_duration_count`, 1)
    .hIncrByFloat(key, `http_${route}_duration_total_ms`, elapsed)
    .expire(key, 8 * 24 * 60 * 60)
    .exec();
}

function increment(name, amount = 1) {
  counters.set(name, Number(counters.get(name) || 0) + amount);
}

function observe(name, milliseconds) {
  const current = durations.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
  current.count += 1;
  current.totalMs += milliseconds;
  current.maxMs = Math.max(current.maxMs, milliseconds);
  durations.set(name, current);
}

function requestMiddleware(req, res, next) {
  const start = Date.now();
  increment("http_requests_in_flight");
  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    increment("http_requests_in_flight", -1);
    increment("http_requests_total");
    increment(`http_status_${res.statusCode}`);
    const route = req.path.startsWith("/api/chat") ? "chat" : req.path.startsWith("/api/documents") ? "documents" : req.path.startsWith("/api/auth") ? "auth" : "other";
    const elapsed = Date.now() - start;
    observe(`http_${route}_duration`, elapsed);
    recordDistributed(res.statusCode, route, elapsed).catch(() => {});
  };
  res.once("finish", finalize);
  res.once("close", finalize);
  next();
}

async function snapshot() {
  const redis = await redisClient();
  const distributedRaw = redis ? await redis.hGetAll(metricsKey()).catch(() => ({})) : {};
  const distributed = Object.fromEntries(Object.entries(distributedRaw).map(([key, value]) => [key, Number(value)]));
  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    counters: Object.fromEntries(counters),
    durations: Object.fromEntries([...durations].map(([name, value]) => [name, {
      count: value.count,
      averageMs: value.count ? Number((value.totalMs / value.count).toFixed(2)) : 0,
      maxMs: value.maxMs,
    }])),
    distributed: { scope: "current UTC day", available: Boolean(redis), values: distributed },
  };
}

function safeEqual(left = "", right = "") {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorize(req) {
  const expected = process.env.METRICS_TOKEN || "";
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return Boolean(expected) && safeEqual(supplied, expected);
}

export const metricsService = { increment, observe, requestMiddleware, snapshot, authorize };

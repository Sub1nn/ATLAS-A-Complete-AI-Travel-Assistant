import { resolveMx } from "node:dns/promises";

const LOOKUP_TIMEOUT_MS = 2500;
const POSITIVE_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const cache = new Map();

function extractDomain(email = "") {
  const domain = String(email).trim().toLowerCase().split("@").pop() || "";
  return domain.replace(/\.$/, "");
}

function reservedDomain(domain) {
  return domain === "localhost"
    || domain.endsWith(".localhost")
    || domain.endsWith(".test")
    || domain.endsWith(".invalid")
    || domain.endsWith(".example");
}

function readCache(domain) {
  const entry = cache.get(domain);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(domain);
    return null;
  }
  return entry.result;
}

function writeCache(domain, result) {
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(domain)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(domain, {
    result,
    expiresAt: Date.now() + (result.acceptsMail ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  });
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("Email domain lookup timed out"), { code: "ETIMEOUT" })), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function checkEmailDomain(email, options = {}) {
  const domain = extractDomain(email);
  if (!domain || reservedDomain(domain)) {
    return { acceptsMail: false, domain, transient: false, reason: "domain_not_mail_capable" };
  }

  const cached = readCache(domain);
  if (cached) return { ...cached, cached: true };

  const resolver = options.resolveMxFn || resolveMx;
  const timeoutMs = Number(options.timeoutMs || LOOKUP_TIMEOUT_MS);
  try {
    const records = await withTimeout(resolver(domain), timeoutMs);
    const acceptsMail = Array.isArray(records) && records.some((record) => {
      const exchange = String(record?.exchange || "").trim();
      return exchange && exchange !== ".";
    });
    const result = {
      acceptsMail,
      domain,
      transient: false,
      reason: acceptsMail ? "mx_found" : "mx_missing",
    };
    writeCache(domain, result);
    return result;
  } catch (error) {
    if (["ENODATA", "ENOTFOUND"].includes(error?.code)) {
      const result = { acceptsMail: false, domain, transient: false, reason: "mx_missing" };
      writeCache(domain, result);
      return result;
    }
    return { acceptsMail: false, domain, transient: true, reason: "lookup_unavailable" };
  }
}

export const emailDomainService = { checkEmailDomain };

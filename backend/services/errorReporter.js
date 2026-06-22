function sanitizedContext(context = {}) {
  const allowed = {};
  for (const [key, value] of Object.entries(context || {})) {
    if (["requestId", "status", "service", "environment", "severity"].includes(key)) allowed[key] = value;
  }
  return allowed;
}

export function reportOperationalError(message, context = {}) {
  const url = process.env.ERROR_REPORTING_WEBHOOK_URL;
  if (!url || process.env.NODE_ENV === "test") return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      application: "atlas-backend",
      message: String(message || "Operational error").slice(0, 500),
      timestamp: new Date().toISOString(),
      context: sanitizedContext(context),
    }),
    signal: controller.signal,
  }).catch(() => {}).finally(() => clearTimeout(timer));
}

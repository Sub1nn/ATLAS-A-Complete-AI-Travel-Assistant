import { reportOperationalError } from "../services/errorReporter.js";

const isProduction = process.env.NODE_ENV === "production";

function redact(value = "") {
  const text = String(value || "");
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|token|secret|password|authorization)[\s:=]+[^\s,}]+/gi, "$1=[redacted]")
    .replace(/gsk_[A-Za-z0-9_\-]+/g, "[redacted-groq-key]")
    .replace(/pcsk_[A-Za-z0-9_\-]+/g, "[redacted-pinecone-key]")
    .replace(/re_[A-Za-z0-9_\-]+/g, "[redacted-resend-key]");
}

function safeMeta(meta = {}) {
  if (!meta || typeof meta !== "object") return undefined;
  const allowed = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/message|content|prompt|query|args|token|secret|password|authorization|key|email|document/i.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value)) allowed[key] = value;
  }
  return Object.keys(allowed).length ? allowed : undefined;
}

function write(level, message, meta) {
  const line = redact(message);
  const cleanMeta = isProduction ? safeMeta(meta) : meta;
  if (cleanMeta && Object.keys(cleanMeta).length) {
    console[level](line, cleanMeta);
  } else {
    console[level](line);
  }
}

export const logger = {
  debug(message, meta) {
    if (!isProduction) write("log", message, meta);
  },
  info(message, meta) {
    write("log", message, meta);
  },
  warn(message, meta) {
    write("warn", message, meta);
  },
  error(message, meta) {
    write("error", message, meta);
    reportOperationalError(redact(message), safeMeta(meta));
  },
  redact,
};

import crypto from "crypto";
import {
  EMAIL_TRANSPORT_MAILTRAP_SANDBOX,
  EMAIL_TRANSPORT_RESEND,
  SUPPORTED_EMAIL_TRANSPORTS,
  selectedEmailTransport,
} from "../config/emailTransport.js";
import {
  EMAIL_VERIFICATION_OPTIONAL,
  SUPPORTED_EMAIL_VERIFICATION_MODES,
  isPasswordRecoveryEnabled,
  selectedEmailVerificationMode,
} from "../config/emailVerification.js";

const PLACEHOLDER_PATTERNS = [
  "change_this",
  "your_",
  "replace_with",
  "dev_secret",
  "optional_future",
  "placeholder",
];

export function isPlaceholderSecret(value = "") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => text.includes(pattern));
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (isPlaceholderSecret(secret) || String(secret).length < 32) {
      throw new Error("JWT_SECRET must be a strong non-placeholder value in production.");
    }
    return secret;
  }

  if (isPlaceholderSecret(secret)) {
    return "dev_secret_change_me_only_for_local_development";
  }

  return secret;
}

export function assertProductionEnvironment() {
  assertAgentEnvironment();
  const emailVerificationMode = selectedEmailVerificationMode();
  if (!SUPPORTED_EMAIL_VERIFICATION_MODES.has(emailVerificationMode)) {
    throw new Error(`EMAIL_VERIFICATION_MODE must be one of: ${[...SUPPORTED_EMAIL_VERIFICATION_MODES].join(", ")}.`);
  }
  if (emailVerificationMode === EMAIL_VERIFICATION_OPTIONAL && process.env.DEPLOYMENT_ENV === "production") {
    throw new Error("Optional email verification is allowed only for development or staging previews.");
  }
  if (process.env.NODE_ENV !== "production") return;

  const emailTransport = selectedEmailTransport();
  if (!SUPPORTED_EMAIL_TRANSPORTS.has(emailTransport)) {
    throw new Error(`EMAIL_TRANSPORT must be one of: ${[...SUPPORTED_EMAIL_TRANSPORTS].join(", ")}.`);
  }
  if (emailTransport === EMAIL_TRANSPORT_MAILTRAP_SANDBOX && process.env.DEPLOYMENT_ENV !== "staging") {
    throw new Error("MAILTRAP Sandbox email delivery is allowed only when DEPLOYMENT_ENV=staging.");
  }
  if (emailTransport === EMAIL_TRANSPORT_MAILTRAP_SANDBOX && isPasswordRecoveryEnabled()) {
    throw new Error("PASSWORD_RECOVERY_ENABLED=false is required with Mailtrap Sandbox because visitors cannot receive its messages.");
  }

  const required = [
    "JWT_SECRET",
    "MONGODB_URI",
    "GROQ_API_KEY",
    "APP_BASE_URL",
    "CORS_ORIGIN",
    "EMAIL_FROM",
    "PRIVACY_POLICY_VERSION",
    "TERMS_VERSION",
    "METRICS_TOKEN",
    "ERROR_REPORTING_WEBHOOK_URL",
    "LEGAL_OPERATOR_NAME",
    "PRIVACY_CONTACT_EMAIL",
    "LEGAL_JURISDICTION",
    "PRIVACY_LAWFUL_BASIS",
    "PRIVACY_TRANSFER_SAFEGUARDS",
    "PRIVACY_SUPERVISORY_AUTHORITY",
    "GLOBAL_DAILY_PROVIDER_CALL_LIMIT",
    "GLOBAL_DAILY_LLM_CALL_LIMIT",
  ];
  if (emailTransport === EMAIL_TRANSPORT_RESEND) required.push("RESEND_API_KEY");
  if (emailTransport === EMAIL_TRANSPORT_MAILTRAP_SANDBOX) {
    required.push("MAILTRAP_SMTP_HOST", "MAILTRAP_SMTP_USER", "MAILTRAP_SMTP_PASS");
  }
  const unsafe = required.filter((key) => isPlaceholderSecret(process.env[key]));

  if (unsafe.length) {
    throw new Error(`Missing or unsafe production environment variables: ${unsafe.join(", ")}`);
  }

  if (String(process.env.JWT_SECRET || "").length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
  }

  if (String(process.env.CORS_ORIGIN || "").includes("*")) {
    throw new Error("CORS_ORIGIN must be an explicit allowlist in production, not a wildcard.");
  }

  if (emailTransport === EMAIL_TRANSPORT_MAILTRAP_SANDBOX) {
    const smtpPort = Number(process.env.MAILTRAP_SMTP_PORT || 2525);
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      throw new Error("MAILTRAP_SMTP_PORT must be a valid TCP port.");
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(process.env.PRIVACY_CONTACT_EMAIL || ""))) {
    throw new Error("PRIVACY_CONTACT_EMAIL must be a valid contact email in production.");
  }

  if (process.env.MONGODB_TRANSACTIONS !== "true") {
    throw new Error("MONGODB_TRANSACTIONS=true is required in production. Use a MongoDB replica set or managed cluster.");
  }

  if (process.env.WORKERS_REQUIRED !== "true") {
    throw new Error("WORKERS_REQUIRED=true is required in production so readiness detects stalled background processing.");
  }

  for (const key of ["GLOBAL_DAILY_PROVIDER_CALL_LIMIT", "GLOBAL_DAILY_LLM_CALL_LIMIT"]) {
    if (!Number.isFinite(Number(process.env[key])) || Number(process.env[key]) <= 0) {
      throw new Error(`${key} must be a positive production spending limit.`);
    }
  }

  try {
    const reportingUrl = new URL(process.env.ERROR_REPORTING_WEBHOOK_URL);
    if (reportingUrl.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    throw new Error("ERROR_REPORTING_WEBHOOK_URL must be a valid HTTPS endpoint in production.");
  }

  const publicUrls = [
    ["APP_BASE_URL", process.env.APP_BASE_URL],
    ...String(process.env.CORS_ORIGIN || "").split(",").filter(Boolean).map((value) => ["CORS_ORIGIN", value]),
  ];
  for (const [key, value] of publicUrls) {
    try {
      const url = new URL(value.trim());
      const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      if (url.protocol !== "https:" && !local) throw new Error("HTTPS required");
    } catch {
      throw new Error(`${key} must contain a valid HTTPS URL in production (HTTP is allowed only for localhost).`);
    }
  }

  if (process.env.REDIS_REQUIRED === "true" && isPlaceholderSecret(process.env.REDIS_URL)) {
    throw new Error("REDIS_URL is required when REDIS_REQUIRED=true.");
  }

  if (process.env.PINECONE_ENABLED === "true") {
    const missingPinecone = ["PINECONE_API_KEY"].filter((key) => isPlaceholderSecret(process.env[key]));
    if (missingPinecone.length) {
      throw new Error(`Pinecone is enabled but missing: ${missingPinecone.join(", ")}`);
    }
    if (isPlaceholderSecret(process.env.PINECONE_INDEX_NAME) && isPlaceholderSecret(process.env.PINECONE_INDEX_HOST)) {
      throw new Error("Pinecone is enabled but PINECONE_INDEX_NAME or PINECONE_INDEX_HOST is missing.");
    }
  }
}

export function assertAgentEnvironment() {
  const graphEnabled = process.env.ATLAS_AGENT_GRAPH_ENABLED === "true";
  const canaryPercent = Number(process.env.ATLAS_AGENT_CANARY_PERCENT ?? (process.env.NODE_ENV === "production" ? 0 : 100));
  if (!Number.isFinite(canaryPercent) || canaryPercent < 0 || canaryPercent > 100) {
    throw new Error("ATLAS_AGENT_CANARY_PERCENT must be between 0 and 100.");
  }
  if (graphEnabled && process.env.NODE_ENV === "production" && canaryPercent <= 0) {
    throw new Error("ATLAS_AGENT_CANARY_PERCENT must be greater than 0 when the authoritative graph is enabled in production.");
  }
  if (graphEnabled && process.env.NODE_ENV === "production" && process.env.ATLAS_AGENT_FALLBACK_ENABLED === "false") {
    throw new Error("ATLAS_AGENT_FALLBACK_ENABLED cannot be false during the production canary.");
  }

  const agentTimeout = Number(process.env.ATLAS_AGENT_REQUEST_TIMEOUT_MS || 60000);
  if (!Number.isFinite(agentTimeout) || agentTimeout < 5000 || agentTimeout > 120000) {
    throw new Error("ATLAS_AGENT_REQUEST_TIMEOUT_MS must be between 5000 and 120000.");
  }

  const tracingEnabled = process.env.LANGSMITH_TRACING === "true" || process.env.ATLAS_LANGSMITH_TRACING === "true";
  if (tracingEnabled && isPlaceholderSecret(process.env.LANGSMITH_API_KEY)) {
    throw new Error("LANGSMITH_API_KEY is required when LANGSMITH_TRACING=true.");
  }

  const samplingRate = Number(process.env.LANGSMITH_TRACING_SAMPLING_RATE ?? 0.1);
  if (!Number.isFinite(samplingRate) || samplingRate < 0 || samplingRate > 1) {
    throw new Error("LANGSMITH_TRACING_SAMPLING_RATE must be between 0 and 1.");
  }

  const checkpointTtl = Number(process.env.ATLAS_AGENT_CHECKPOINT_TTL_SECONDS || 7 * 24 * 60 * 60);
  if (!Number.isFinite(checkpointTtl) || checkpointTtl < 3600) {
    throw new Error("ATLAS_AGENT_CHECKPOINT_TTL_SECONDS must be at least 3600.");
  }

  if (process.env.NODE_ENV === "production" && process.env.LANGSMITH_ENDPOINT) {
    try {
      const endpoint = new URL(process.env.LANGSMITH_ENDPOINT);
      if (endpoint.protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      throw new Error("LANGSMITH_ENDPOINT must be a valid HTTPS URL in production.");
    }
  }
}

export function createRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(token = "") {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function maskSecret(value = "") {
  if (!value) return "Not set";
  const text = String(value);
  if (text.length <= 10) return `${text.slice(0, 3)}...`;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

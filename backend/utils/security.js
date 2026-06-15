import crypto from "crypto";

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
  if (process.env.NODE_ENV !== "production") return;

  const required = ["JWT_SECRET", "MONGODB_URI", "GROQ_API_KEY", "APP_BASE_URL"];
  const unsafe = required.filter((key) => isPlaceholderSecret(process.env[key]));

  if (unsafe.length) {
    throw new Error(`Missing or unsafe production environment variables: ${unsafe.join(", ")}`);
  }

  if (String(process.env.JWT_SECRET || "").length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
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

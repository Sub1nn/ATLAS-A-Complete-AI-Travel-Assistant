export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("JWT_SECRET is required in production. Set a strong secret before starting ATLAS.");
  }

  return secret || "dev_secret_change_me_only_for_local_development";
}

export function assertProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  const required = ["JWT_SECRET", "MONGODB_URI", "GROQ_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
}

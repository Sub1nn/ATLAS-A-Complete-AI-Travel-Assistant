// Quick setup verification for ATLAS backend

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

console.log("🔍 Checking environment setup...");

const requiredEnvVars = [
  "GROQ_API_KEY",
  "JWT_SECRET",
  "MONGODB_URI",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];

const optionalEnvVars = [
  "GOOGLE_MAPS_SERVER_API_KEY",
  "OPEN_WEATHER_KEY",
  "NEWS_API_KEY",
  "YELP_API_KEY",
  "PINECONE_API_KEY",
  "PINECONE_INDEX_NAME",
  "PINECONE_INDEX_HOST",
  "HUGGINGFACE_API_KEY",
];

function isPlaceholder(value) {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();

  return (
    normalized === "" ||
    normalized.includes("your_") ||
    normalized.includes("change_this") ||
    normalized.includes("optional_future") ||
    normalized.includes("replace_with")
  );
}

function maskValue(value) {
  if (!value) return "Not set";
  if (value.length <= 10) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

console.log("\n📋 Required environment variables:");

const missing = [];

for (const envVar of requiredEnvVars) {
  const value = process.env[envVar];

  if (isPlaceholder(value)) {
    console.log(`❌ ${envVar}: Missing or placeholder value`);
    missing.push(envVar);
  } else {
    console.log(`✅ ${envVar}: ${maskValue(value)}`);
  }
}

console.log("\n📋 Optional environment variables:");

for (const envVar of optionalEnvVars) {
  const value = process.env[envVar];

  if (isPlaceholder(value)) {
    console.log(`⚠️  ${envVar}: Not set or placeholder`);
  } else {
    console.log(`✅ ${envVar}: ${maskValue(value)}`);
  }
}

if (missing.length > 0) {
  console.log("\n❌ Missing or placeholder environment variables:");
  missing.forEach((envVar) => console.log(`   - ${envVar}`));

  console.log("\n💡 Fix:");
  console.log("   Add real API keys inside backend/.env");
  console.log("   Do not use placeholder values from .env.example");
  process.exit(1);
}

console.log("\n✅ All required environment variables are set.");

try {
  console.log("\n🔍 Testing module imports...");

  await import("../app.js");

  console.log("✅ Backend modules imported successfully.");
  console.log("🚀 Ready to start the server with: npm run dev");
} catch (error) {
  console.log("❌ Module import error:", error.message);
  process.exit(1);
}

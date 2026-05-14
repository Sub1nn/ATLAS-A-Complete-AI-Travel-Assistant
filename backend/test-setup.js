// Quick setup verification
import dotenv from "dotenv";

dotenv.config();

console.log("🔍 Checking environment setup...");

const requiredEnvVars = [
  "GROQ_API_KEY",
  "GOOGLE_API_KEY",
  "OPEN_WEATHER_KEY",
  "GOOGLE_PLACES_API_KEY",
  "NEWS_API_KEY",
];

const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missing.length > 0) {
  console.log("❌ Missing environment variables:");
  missing.forEach((envVar) => console.log(`   - ${envVar}`));
  console.log(
    "\n💡 Please add these to your .env file before starting the server."
  );
  process.exit(1);
} else {
  console.log("✅ All required environment variables are set!");
  console.log("🚀 Ready to start the server with: npm run dev");
}

// Test imports
try {
  console.log("🔍 Testing module imports...");

  // Test if all modules can be imported without errors
  await import("./app.js");
  console.log("✅ All modules imported successfully!");
} catch (error) {
  console.log("❌ Module import error:", error.message);
  process.exit(1);
}

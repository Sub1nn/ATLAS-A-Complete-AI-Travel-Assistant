// Network and API diagnostics for ATLAS backend

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const { networkTest } = await import("../utils/networkTest.js");

console.log("🔍 ATLAS Diagnostic Tool");
console.log("=".repeat(50));

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

async function runDiagnostics() {
  console.log("\n📋 Environment Variables Check:");

  const requiredVars = [
    "GROQ_API_KEY",
    "JWT_SECRET",
    "MONGODB_URI",
    "RESEND_API_KEY",
    "EMAIL_FROM",
  ];

  const optionalVars = [
    "GOOGLE_MAPS_SERVER_API_KEY",
    "OPEN_WEATHER_KEY",
    "NEWS_API_KEY",
    "YELP_API_KEY",
    "PINECONE_API_KEY",
    "HUGGINGFACE_API_KEY",
  ];

  const missingRequired = [];

  for (const varName of requiredVars) {
    const value = process.env[varName];

    if (isPlaceholder(value)) {
      console.log(`❌ ${varName}: Missing or placeholder`);
      missingRequired.push(varName);
    } else {
      console.log(`✅ ${varName}: ${maskValue(value)}`);
    }
  }

  console.log("\n📋 Optional Variables Check:");

  for (const varName of optionalVars) {
    const value = process.env[varName];

    if (isPlaceholder(value)) {
      console.log(`⚠️  ${varName}: Not set or placeholder`);
    } else {
      console.log(`✅ ${varName}: ${maskValue(value)}`);
    }
  }

  if (missingRequired.length > 0) {
    console.log(
      "\n⚠️  Some required API keys are missing or still placeholders.",
    );
    console.log(
      "   Network tests may fail until backend/.env contains real values.",
    );
  }

  console.log("\n🌐 Network Connectivity Test:");

  try {
    const results = await networkTest.testAllAPIs();

    Object.entries(results).forEach(([api, result]) => {
      if (result.success) {
        console.log(`✅ ${api.toUpperCase()}: Connected (${result.status})`);

        if (result.api_status) {
          console.log(`   API status: ${result.api_status}`);
        }

        if (typeof result.results_count === "number") {
          console.log(`   Results count: ${result.results_count}`);
        }
      } else {
        console.log(`❌ ${api.toUpperCase()}: Failed - ${result.error}`);

        if (result.code) {
          console.log(`   Error Code: ${result.code}`);
        }

        if (result.status) {
          console.log(`   HTTP Status: ${result.status}`);
        }
      }
    });

    const workingAPIs = Object.values(results).filter((r) => r.success).length;
    const totalAPIs = Object.keys(results).length;

    console.log(`\n📊 Summary: ${workingAPIs}/${totalAPIs} APIs working`);

    if (workingAPIs === 0) {
      console.log("\n🚨 No APIs are working. Possible issues:");
      console.log("   • backend/.env is not configured with real API keys");
      console.log("   • API keys are expired, restricted, or disabled");
      console.log("   • Internet connection or firewall issue");
      console.log("   • Provider service outage");
    } else if (workingAPIs < totalAPIs) {
      console.log(
        "\n⚠️  Some APIs are not working. ATLAS will use fallback responses where needed.",
      );
    } else {
      console.log("\n🎉 All APIs are working.");
    }
  } catch (error) {
    console.error("❌ Diagnostic test failed:", error.message);
  }
}

runDiagnostics()
  .then(() => {
    console.log("\n🏁 Diagnostic complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Diagnostic failed:", error);
    process.exit(1);
  });

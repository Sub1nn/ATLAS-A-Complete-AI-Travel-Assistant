// diagnostic.js - Network and API diagnostics
import dotenv from "dotenv";
import { networkTest } from "./utils/networkTest.js";

dotenv.config();

console.log("🔍 ATLAS Diagnostic Tool");
console.log("=".repeat(50));

async function runDiagnostics() {
  // Test environment variables
  console.log("\n📋 Environment Variables Check:");
  const requiredVars = [
    "GROQ_API_KEY",
    "GOOGLE_API_KEY",
    "OPEN_WEATHER_KEY",
    "GOOGLE_PLACES_API_KEY",
    "NEWS_API_KEY",
  ];

  requiredVars.forEach((varName) => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 8)}...`);
    } else {
      console.log(`❌ ${varName}: Not set`);
    }
  });

  // Test network connectivity
  console.log("\n🌐 Network Connectivity Test:");
  try {
    const results = await networkTest.testAllAPIs();

    Object.entries(results).forEach(([api, result]) => {
      if (result.success) {
        console.log(`✅ ${api.toUpperCase()}: Connected (${result.status})`);
      } else {
        console.log(`❌ ${api.toUpperCase()}: Failed - ${result.error}`);
        if (result.code) {
          console.log(`   Error Code: ${result.code}`);
        }
      }
    });

    const workingAPIs = Object.values(results).filter((r) => r.success).length;
    const totalAPIs = Object.keys(results).length;

    console.log(`\n📊 Summary: ${workingAPIs}/${totalAPIs} APIs working`);

    if (workingAPIs === 0) {
      console.log("\n🚨 No APIs are working. Possible issues:");
      console.log("   • Check your internet connection");
      console.log("   • Verify your API keys are correct");
      console.log("   • Check if you're behind a firewall/proxy");
      console.log("   • Some services might be experiencing outages");
    } else if (workingAPIs < totalAPIs) {
      console.log(
        "\n⚠️  Some APIs are not working. The app will use fallback responses when needed."
      );
    } else {
      console.log(
        "\n🎉 All APIs are working! Your ATLAS app should function perfectly."
      );
    }
  } catch (error) {
    console.error("❌ Diagnostic test failed:", error.message);
  }
}

// Run diagnostics
runDiagnostics()
  .then(() => {
    console.log("\n🏁 Diagnostic complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Diagnostic failed:", error);
    process.exit(1);
  });

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { networkTest } from "../utils/networkTest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const result = await networkTest.testGooglePlaces();
if (!result.success) {
  console.error("Google Places API (New) check failed:", result.error || result.api_status || result.status);
  process.exit(1);
}

console.log(`Google Places API (New) is working. Results returned: ${result.results_count}.`);

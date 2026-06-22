import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { closeDatabase, connectDatabase } from "../db/mongoose.js";
import { workerHealthService } from "../services/workerHealthService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const workerName = process.argv[2];
if (!workerName || !(await connectDatabase())) process.exit(1);
const healthy = await workerHealthService.isHealthy(workerName);
await closeDatabase();
process.exit(healthy ? 0 : 1);

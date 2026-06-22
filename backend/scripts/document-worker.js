import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDatabase } from "../db/mongoose.js";
import { documentQueueService } from "../services/documentQueueService.js";
import { accountDeletionService } from "../services/accountDeletionService.js";
import { assertProductionEnvironment } from "../utils/security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

assertProductionEnvironment();
if (!(await connectDatabase())) throw new Error("MongoDB connection is unavailable");
await Promise.all([documentQueueService.startWorker(), accountDeletionService.startWorker()]);

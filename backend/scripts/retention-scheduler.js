import { spawn } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDatabase } from "../db/mongoose.js";
import { workerHealthService } from "../services/workerHealthService.js";
import { assertProductionEnvironment } from "../utils/security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
assertProductionEnvironment();
if (!(await connectDatabase())) throw new Error("MongoDB connection is unavailable");
await workerHealthService.start("retention");

const intervalMs = Math.max(60 * 60 * 1000, Number(process.env.RETENTION_INTERVAL_MS || 24 * 60 * 60 * 1000));

async function runRetention() {
  await new Promise((resolve) => {
    const child = spawn(process.execPath, [new URL("./enforce-retention.js", import.meta.url).pathname], { stdio: "inherit", env: process.env });
    child.once("exit", (code) => {
      if (code) console.error(`Retention enforcement exited with code ${code}`);
      resolve();
    });
  });
}

while (true) {
  await runRetention();
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

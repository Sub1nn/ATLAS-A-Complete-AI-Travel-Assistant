import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

import app from "./app.js";
import { assertProductionEnvironment } from "./utils/security.js";
import { closeDatabase, connectDatabase } from "./db/mongoose.js";
import { closeCache, initializeCache } from "./services/cacheService.js";
import { closeRateLimitStore } from "./config/rateLimiter.js";
import { logger } from "./utils/logger.js";
import { initializeAtlasGraph } from "./agents/atlasGraph.js";

const PORT = process.env.PORT || 4000;
let server;

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully.`);
  if (server) {
    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();
    await new Promise((resolve) => server.close(resolve));
    await Promise.allSettled([closeDatabase(), closeCache(), closeRateLimitStore()]);
    clearTimeout(forceExit);
    process.exit(0);
  } else {
    await Promise.allSettled([closeDatabase(), closeCache(), closeRateLimitStore()]);
    process.exit(0);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { reason: error.message });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: reason?.message || String(reason) });
  if (process.env.NODE_ENV === "production") process.exit(1);
});

assertProductionEnvironment();
await connectDatabase();
await initializeAtlasGraph();
await initializeCache();

server = app.listen(PORT, () => {
  logger.info(`ATLAS Travel Assistant running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`Health check enabled at /health`);
});

export default app;

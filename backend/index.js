import dotenv from "dotenv";
import app from "./app.js";
import { connectDatabase } from "./db/mongoose.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

await connectDatabase();

app.listen(PORT, () => {
  console.log(`🚀 ATLAS Travel Assistant running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log("🛡️  Production security enabled");
});

export default app;

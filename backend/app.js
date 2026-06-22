// Express Application Setup
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import crypto from "crypto";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import documentRoutes from "./routes/documents.js";
import { rateLimiter } from "./config/rateLimiter.js";
import { databaseReady } from "./db/mongoose.js";
import { cacheStatus } from "./services/cacheService.js";
import { logger } from "./utils/logger.js";
import { metricsService } from "./services/metricsService.js";
import { accountDeletionService } from "./services/accountDeletionService.js";
import { documentDeletionService } from "./services/documentDeletionService.js";
import { workerHealthService } from "./services/workerHealthService.js";
import { asyncHandler } from "./utils/asyncHandler.js";

const app = express();
app.disable("x-powered-by");
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy && trustProxy !== "false" && trustProxy !== "0") {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

app.use((req, res, next) => {
  const incoming = String(req.headers["x-request-id"] || "");
  req.requestId = /^[a-zA-Z0-9_-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  res.setHeader("X-Trace-Id", req.requestId);
  next();
});
app.use(metricsService.requestMiddleware);

// Security middleware - Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const error = new Error("Origin is not allowed by CORS");
      error.status = 403;
      return callback(error);
    },
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);
/* app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
    optionsSuccessStatus: 200,
  })
); */

// Logging middleware
morgan.token("url", (req) => logger.redact(req.originalUrl || req.url));
morgan.token("request-id", (req) => req.requestId || "-");
if (process.env.NODE_ENV === "production") {
  app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" request_id=:request-id'));
} else if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Body parsing middleware
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || "1mb" }));

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Static files
app.use(express.static("public"));

// Rate limiting
app.use(rateLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api", chatRoutes);

app.get("/api/legal", (req, res) => {
  res.json({
    operatorName: process.env.LEGAL_OPERATOR_NAME || "Not configured",
    privacyContact: process.env.PRIVACY_CONTACT_EMAIL || "Not configured",
    jurisdiction: process.env.LEGAL_JURISDICTION || "Not configured",
    lawfulBasis: process.env.PRIVACY_LAWFUL_BASIS || "Not configured",
    transferSafeguards: process.env.PRIVACY_TRANSFER_SAFEGUARDS || "Not configured",
    supervisoryAuthority: process.env.PRIVACY_SUPERVISORY_AUTHORITY || "Not configured",
    privacyVersion: process.env.PRIVACY_POLICY_VERSION || "",
    termsVersion: process.env.TERMS_VERSION || "",
  });
});

// Health check endpoint
async function healthPayload() {
  const cache = cacheStatus();
  const workers = process.env.WORKERS_REQUIRED === "true" && databaseReady()
    ? await workerHealthService.snapshot().catch(() => ({ healthy: false, missing: ["worker-status-unavailable"] }))
    : null;
  const ready = databaseReady() && (process.env.REDIS_REQUIRED !== "true" || cache.redisConnected) && (!workers || workers.healthy);
  return {
    status: ready ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    uptime: process.uptime(),
    database: databaseReady() ? "connected" : "unavailable",
    cache,
    ...(workers ? { workers } : {}),
  };
}

app.get("/health/live", (req, res) => {
  res.json({ status: "alive", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get(["/health", "/health/ready"], asyncHandler(async (req, res) => {
  const payload = await healthPayload();
  res.status(payload.status === "healthy" ? 200 : 503).json(payload);
}));

app.get("/internal/metrics", asyncHandler(async (req, res) => {
  if (!metricsService.authorize(req)) return res.status(404).json({ message: "Not found" });
  const [metrics, workers] = await Promise.all([metricsService.snapshot(), workerHealthService.snapshot()]);
  return res.json({ ...metrics, workers });
}));

app.post("/internal/account-deletions/:id/retry", asyncHandler(async (req, res) => {
  if (!metricsService.authorize(req)) return res.status(404).json({ message: "Not found" });
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: "Invalid deletion job ID" });
  const job = await accountDeletionService.retryDeadLetter(req.params.id);
  if (!job) return res.status(404).json({ message: "Dead-letter deletion job not found" });
  return res.status(202).json({ ok: true, status: job.status });
}));

app.post("/internal/document-deletions/:id/retry", asyncHandler(async (req, res) => {
  if (!metricsService.authorize(req)) return res.status(404).json({ message: "Not found" });
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) return res.status(400).json({ message: "Invalid deletion job ID" });
  const job = await documentDeletionService.retryDeadLetter(req.params.id);
  if (!job) return res.status(404).json({ message: "Dead-letter deletion job not found" });
  return res.status(202).json({ ok: true, status: job.status });
}));

app.get("/internal/deletion-dead-letters", asyncHandler(async (req, res) => {
  if (!metricsService.authorize(req)) return res.status(404).json({ message: "Not found" });
  const [accounts, documents] = await Promise.all([
    accountDeletionService.listDeadLetters(),
    documentDeletionService.listDeadLetters(),
  ]);
  return res.json({ accounts, documents });
}));

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    logger.error("Global error", { reason: err.message, requestId: req.requestId });
  } else {
    logger.error("Global error", { reason: err.message, requestId: req.requestId });
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const isClientError =
    err.name === "MulterError" ||
    /Only PDF, DOCX and TXT|file too large|Unexpected field/i.test(
      err.message || "",
    );

  const status = isClientError ? 400 : Number(err.status || 500);
  res.status(status).json({
    error: isClientError ? "Invalid request" : status < 500 ? "Request rejected" : "Internal server error",
    message: isClientError
      ? err.message
      : status < 500 || isDevelopment
        ? err.message
        : "Something went wrong",
    stack: !isClientError && isDevelopment ? err.stack : undefined,
    requestId: req.requestId,
  });
});

export default app;

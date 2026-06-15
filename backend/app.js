// Express Application Setup
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import documentRoutes from "./routes/documents.js";
import { rateLimiter } from "./config/rateLimiter.js";
import { databaseReady } from "./db/mongoose.js";

const app = express();
app.set("trust proxy", 1); // trust proxy

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
      return callback(new Error("Not allowed by CORS"));
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
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    uptime: process.uptime(),
    database: databaseReady() ? "connected" : "unavailable",
  });
});

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
    console.error("❌ Global error:", err.message);
  } else {
    console.error("❌ Global error:", err);
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const isClientError =
    err.name === "MulterError" ||
    /Only PDF, DOCX and TXT|file too large|Unexpected field/i.test(
      err.message || "",
    );

  res.status(isClientError ? 400 : err.status || 500).json({
    error: isClientError ? "Invalid request" : "Internal server error",
    message: isClientError
      ? err.message
      : isDevelopment
        ? err.message
        : "Something went wrong",
    stack: !isClientError && isDevelopment ? err.stack : undefined,
  });
});

export default app;

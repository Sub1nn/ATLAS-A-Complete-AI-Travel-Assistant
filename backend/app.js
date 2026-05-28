// app.js - Express Application Setup
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import documentRoutes from "./routes/documents.js";
import { rateLimiter } from "./config/rateLimiter.js";

const app = express();

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
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Logging middleware
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Body parsing middleware
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
  console.error("❌ Global error:", err);

  const isDevelopment = process.env.NODE_ENV !== "production";
  const isClientError = err.name === "MulterError" || /Only PDF, DOCX and TXT|file too large|Unexpected field/i.test(err.message || "");

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

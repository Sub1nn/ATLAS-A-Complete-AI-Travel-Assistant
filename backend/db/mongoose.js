import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

let isConnected = false;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const message = "MONGODB_URI is not set. Persistent users, chat history and document memory cannot work.";
    if (process.env.NODE_ENV === "production") throw new Error(message);
    logger.warn(message);
    return false;
  }

  if (isConnected && mongoose.connection.readyState === 1) return true;

  try {
    mongoose.set("strictQuery", true);
    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      logger.warn("MongoDB disconnected");
    });

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 1),
      autoIndex: process.env.NODE_ENV !== "production" || process.env.MONGODB_AUTO_INDEX === "true",
    });

    isConnected = true;
    logger.info("MongoDB connected");
    return true;
  } catch (error) {
    isConnected = false;
    logger.error("MongoDB connection failed", { reason: error.message });
    if (process.env.NODE_ENV === "production") throw error;
    logger.warn("The app will continue in development, but login/history/document chat will not work until MongoDB is available.");
    return false;
  }
}

export function databaseReady() {
  return mongoose.connection.readyState === 1;
}

export async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  isConnected = false;
}

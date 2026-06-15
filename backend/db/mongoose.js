import mongoose from "mongoose";

let isConnected = false;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const message = "MONGODB_URI is not set. Persistent users, chat history and document memory cannot work.";
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(`⚠️ ${message}`);
    return false;
  }

  if (isConnected && mongoose.connection.readyState === 1) return true;

  try {
    mongoose.set("strictQuery", true);
    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      console.warn("⚠️ MongoDB disconnected");
    });

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 1),
      autoIndex: process.env.NODE_ENV !== "production",
    });

    isConnected = true;
    console.log("✅ MongoDB connected");
    return true;
  } catch (error) {
    isConnected = false;
    console.error("❌ MongoDB connection failed:", error.message);
    if (process.env.NODE_ENV === "production") throw error;
    console.warn("⚠️ The app will continue in development, but login/history/document chat will not work until MongoDB is available.");
    return false;
  }
}

export function databaseReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

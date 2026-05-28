import mongoose from "mongoose";

let isConnected = false;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn("⚠️ MONGODB_URI is not set. Persistent users, chat history and document memory are disabled.");
    return false;
  }

  if (isConnected) return true;

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
    });
    isConnected = true;
    console.log("✅ MongoDB connected");
    return true;
  } catch (error) {
    isConnected = false;
    console.error("❌ MongoDB connection failed:", error.message);
    console.warn("⚠️ The app will continue, but account login/history/document chat will not work until MongoDB is available.");
    return false;
  }
}

export function databaseReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

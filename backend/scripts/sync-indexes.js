import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDatabase, closeDatabase } from "../db/mongoose.js";
import { User } from "../models/User.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Document } from "../models/Document.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

try {
  const connected = await connectDatabase();
  if (!connected) throw new Error("MongoDB connection is unavailable");
  await Promise.all([
    User.createIndexes(),
    Conversation.createIndexes(),
    Message.createIndexes(),
    Document.createIndexes(),
  ]);
  console.log("MongoDB indexes created successfully.");
} finally {
  await closeDatabase();
}

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDatabase, closeDatabase } from "../db/mongoose.js";
import { User } from "../models/User.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Document } from "../models/Document.js";
import { Session } from "../models/Session.js";
import { ChatRequest } from "../models/ChatRequest.js";
import { DailyUsage } from "../models/DailyUsage.js";
import { AccountDeletion } from "../models/AccountDeletion.js";
import { StorageUsage } from "../models/StorageUsage.js";
import { OperationLease } from "../models/OperationLease.js";
import { DocumentDeletion } from "../models/DocumentDeletion.js";
import { WorkerHeartbeat } from "../models/WorkerHeartbeat.js";
import { GlobalUsage } from "../models/GlobalUsage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

try {
  const connected = await connectDatabase();
  if (!connected) throw new Error("MongoDB connection is unavailable");

  // These collections have changed index options across releases. Reconcile
  // them before creating the remaining additive indexes so an old index with
  // the same name cannot block startup migrations.
  await Session.syncIndexes();
  await AccountDeletion.syncIndexes();

  await Promise.all([
    User.createIndexes(),
    Conversation.createIndexes(),
    Message.createIndexes(),
    Document.createIndexes(),
    ChatRequest.createIndexes(),
    DailyUsage.createIndexes(),
    StorageUsage.createIndexes(),
    OperationLease.createIndexes(),
    DocumentDeletion.createIndexes(),
    WorkerHeartbeat.createIndexes(),
    GlobalUsage.createIndexes(),
  ]);
  console.log("MongoDB indexes created successfully.");
} finally {
  await closeDatabase();
}

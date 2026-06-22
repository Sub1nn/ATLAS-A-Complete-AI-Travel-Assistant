import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDatabase, closeDatabase } from "../db/mongoose.js";
import { Conversation } from "../models/Conversation.js";
import { Document } from "../models/Document.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { vectorStore } from "../services/vectorStore.js";
import { documentQueueService } from "../services/documentQueueService.js";
import { assertProductionEnvironment } from "../utils/security.js";
import { storageUsageService } from "../services/storageUsageService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
assertProductionEnvironment();

const summary = { users: 0, messages: 0, conversations: 0, documents: 0, remoteDeletionFailures: 0 };

try {
  if (!(await connectDatabase())) throw new Error("MongoDB connection is unavailable");
  const users = User.find({}).select("_id dataRetentionDays").cursor();

  for await (const user of users) {
    summary.users += 1;
    const days = Math.max(30, Math.min(Number(user.dataRetentionDays || process.env.DEFAULT_DATA_RETENTION_DAYS || 365), 730));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const oldDocuments = await Document.find({ userId: user._id, createdAt: { $lt: cutoff } }).select("_id chunks +rawUploadId").lean();
    for (const document of oldDocuments) {
      if (vectorStore.isConfigured()) {
        const remote = await vectorStore.deleteDocumentChunks({ userId: user._id, documentId: document._id, chunkCount: document.chunks?.length || 0 });
        if (!remote.deleted) {
          summary.remoteDeletionFailures += 1;
          continue;
        }
      }
      const rawDeletion = await documentQueueService.deleteUpload(document.rawUploadId);
      if (!rawDeletion.deleted) {
        summary.remoteDeletionFailures += 1;
        continue;
      }
      const deleted = await Document.deleteOne({ _id: document._id, userId: user._id });
      summary.documents += deleted.deletedCount || 0;
      await Conversation.updateMany({ userId: user._id, documentIds: document._id }, { $pull: { documentIds: document._id } });
    }

    const deletedMessages = await Message.deleteMany({ userId: user._id, createdAt: { $lt: cutoff } });
    summary.messages += deletedMessages.deletedCount || 0;
    await Conversation.updateMany({ userId: user._id }, { $unset: { messages: "" } });

    const conversationStats = await Message.aggregate([
      { $match: { userId: user._id } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversationId", messageCount: { $sum: 1 }, lastMessagePreview: { $first: "$content" } } },
    ]);
    if (conversationStats.length) {
      await Conversation.bulkWrite(conversationStats.map((item) => ({
        updateOne: {
          filter: { _id: item._id, userId: user._id },
          update: { $set: { messageCount: item.messageCount, lastMessagePreview: String(item.lastMessagePreview || "").slice(0, 180) } },
        },
      })));
    }
    const activeIds = conversationStats.map((item) => item._id);
    const emptyConversationFilter = { userId: user._id, updatedAt: { $lt: cutoff } };
    if (activeIds.length) emptyConversationFilter._id = { $nin: activeIds };
    const deletedConversations = await Conversation.deleteMany(emptyConversationFilter);
    summary.conversations += deletedConversations.deletedCount || 0;
    await storageUsageService.reconcile(user._id);
  }

  console.log(JSON.stringify({ ok: summary.remoteDeletionFailures === 0, ...summary }));
  if (summary.remoteDeletionFailures) process.exitCode = 2;
} finally {
  await closeDatabase();
}

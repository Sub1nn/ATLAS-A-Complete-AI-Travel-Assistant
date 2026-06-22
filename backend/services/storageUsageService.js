import { Document } from "../models/Document.js";
import { StorageUsage } from "../models/StorageUsage.js";

async function ensure(userId) {
  if (await StorageUsage.exists({ userId })) return;
  const [current] = await Document.aggregate([
    { $match: { userId } },
    { $group: { _id: null, documentCount: { $sum: 1 }, bytes: { $sum: "$size" } } },
  ]);
  try {
    await StorageUsage.create({ userId, documentCount: current?.documentCount || 0, bytes: current?.bytes || 0 });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

async function reserve(userId, bytes, { maxDocuments, maxBytes }) {
  await ensure(userId);
  const updated = await StorageUsage.findOneAndUpdate(
    {
      userId,
      documentCount: { $lt: maxDocuments },
      bytes: { $lte: maxBytes - bytes },
    },
    { $inc: { documentCount: 1, bytes } },
    { new: true },
  );
  if (updated) return { allowed: true, documentCount: updated.documentCount, bytes: updated.bytes };
  const current = await StorageUsage.findOne({ userId }).lean();
  return {
    allowed: false,
    reason: Number(current?.documentCount || 0) >= maxDocuments ? "document_limit" : "storage_limit",
    documentCount: current?.documentCount || 0,
    bytes: current?.bytes || 0,
  };
}

async function release(userId, bytes, count = 1) {
  await StorageUsage.updateOne(
    { userId },
    [{ $set: { documentCount: { $max: [0, { $subtract: ["$documentCount", count] }] }, bytes: { $max: [0, { $subtract: ["$bytes", bytes] }] } } }],
  );
}

async function reconcile(userId) {
  const [current] = await Document.aggregate([
    { $match: { userId } },
    { $group: { _id: null, documentCount: { $sum: 1 }, bytes: { $sum: "$size" } } },
  ]);
  await StorageUsage.updateOne(
    { userId },
    { $set: { documentCount: current?.documentCount || 0, bytes: current?.bytes || 0 } },
    { upsert: true },
  );
}

export const storageUsageService = { reserve, release, reconcile };

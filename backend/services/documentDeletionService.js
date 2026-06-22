import crypto from "crypto";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Document } from "../models/Document.js";
import { DocumentDeletion } from "../models/DocumentDeletion.js";
import { StorageUsage } from "../models/StorageUsage.js";
import { documentQueueService } from "./documentQueueService.js";
import { reportOperationalError } from "./errorReporter.js";
import { vectorStore } from "./vectorStore.js";
import { logger } from "../utils/logger.js";

const leaseMs = () => Math.max(60000, Number(process.env.DOCUMENT_DELETION_LEASE_MS || 5 * 60 * 1000));
const maxAttempts = () => Math.max(1, Number(process.env.DOCUMENT_DELETION_MAX_ATTEMPTS || 12));

async function enqueue(documentId, userId, reason = "user", mongoSession = null) {
  const options = mongoSession ? { session: mongoSession } : undefined;
  await Document.updateOne({ _id: documentId, userId }, { $set: { deletionPending: true } }, options);
  return DocumentDeletion.findOneAndUpdate(
    { documentId, userId },
    {
      $set: { status: "queued", reason, nextAttemptAt: new Date(), lastError: "" },
      $unset: { leaseUntil: "", leaseOwner: "" },
      $setOnInsert: { attempts: 0 },
    },
    { upsert: true, new: true, ...(mongoSession ? { session: mongoSession } : {}) },
  );
}

async function requestDeletion(documentId, userId, reason = "user") {
  if (process.env.MONGODB_TRANSACTIONS !== "true") return enqueue(documentId, userId, reason);
  const session = await mongoose.startSession();
  try {
    let job;
    await session.withTransaction(async () => { job = await enqueue(documentId, userId, reason, session); });
    return job;
  } finally {
    await session.endSession();
  }
}

async function claim() {
  const now = new Date();
  return DocumentDeletion.findOneAndUpdate(
    {
      attempts: { $lt: maxAttempts() },
      status: { $ne: "dead_letter" },
      $or: [
        { status: { $in: ["queued", "failed"] }, $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
        { status: "processing", leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: { status: "processing", leaseOwner: crypto.randomUUID(), leaseUntil: new Date(now.getTime() + leaseMs()), lastError: "" },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } },
  ).select("+leaseOwner");
}

async function deleteLocal(document, job, session = null) {
  const options = session ? { session } : undefined;
  const fenced = await DocumentDeletion.deleteOne({ _id: job._id, leaseOwner: job.leaseOwner, status: "processing" }, options);
  if (!fenced.deletedCount) throw Object.assign(new Error("Document deletion lease ownership was lost before completion"), { code: "DOCUMENT_DELETION_LEASE_LOST" });
  await Document.deleteOne({ _id: document._id, userId: document.userId, deletionPending: true }, options);
  await Conversation.updateMany({ userId: document.userId, documentIds: document._id }, { $pull: { documentIds: document._id } }, options);
  await StorageUsage.updateOne(
    { userId: document.userId },
    [{ $set: { documentCount: { $max: [0, { $subtract: ["$documentCount", 1] }] }, bytes: { $max: [0, { $subtract: ["$bytes", Number(document.size || 0)] }] } } }],
    options,
  );
}

function startHeartbeat(job) {
  const timer = setInterval(() => {
    DocumentDeletion.updateOne(
      { _id: job._id, leaseOwner: job.leaseOwner, status: "processing" },
      { $set: { leaseUntil: new Date(Date.now() + leaseMs()) } },
    ).catch(() => {});
  }, Math.max(15000, Math.floor(leaseMs() / 3)));
  timer.unref();
  return timer;
}

async function processNext() {
  const job = await claim();
  if (!job) return { skipped: true };
  const heartbeat = startHeartbeat(job);
  try {
    const document = await Document.findOne({ _id: job.documentId, userId: job.userId }).select("_id userId size chunks processingStatus leaseUntil +rawUploadId").lean();
    if (!document) {
      await DocumentDeletion.deleteOne({ _id: job._id, leaseOwner: job.leaseOwner });
      return { deleted: true, absent: true };
    }
    if (document.processingStatus === "processing" && document.leaseUntil > new Date()) {
      await DocumentDeletion.updateOne(
        { _id: job._id, leaseOwner: job.leaseOwner },
        { $set: { status: "queued", nextAttemptAt: new Date(Date.now() + 5000), lastError: "Waiting for active document lease" }, $unset: { leaseUntil: "", leaseOwner: "" }, $inc: { attempts: -1 } },
      );
      return { waiting: true };
    }
    await Document.updateOne({ _id: document._id, userId: document.userId }, { $set: { deletionPending: true }, $unset: { leaseUntil: "", leaseOwner: "" } });
    if (vectorStore.isConfigured()) {
      const remote = await vectorStore.deleteDocumentChunks({ userId: document.userId, documentId: document._id, chunkCount: document.chunks?.length || 0 });
      if (!remote.deleted) throw new Error(`Remote vector deletion failed: ${remote.reason || "unknown error"}`);
    }
    const raw = await documentQueueService.deleteUpload(document.rawUploadId);
    if (!raw.deleted) throw new Error(`Original upload deletion failed: ${raw.reason || "unknown error"}`);

    if (process.env.MONGODB_TRANSACTIONS === "true") {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(() => deleteLocal(document, job, session));
      } finally {
        await session.endSession();
      }
    } else {
      await deleteLocal(document, job);
    }
    return { deleted: true, documentId: document._id.toString() };
  } catch (error) {
    const exhausted = Number(job.attempts || 0) >= maxAttempts();
    const delay = Math.min(60 * 60 * 1000, 15000 * (2 ** Math.max(0, Number(job.attempts || 1) - 1)));
    await DocumentDeletion.updateOne(
      { _id: job._id, leaseOwner: job.leaseOwner },
      { $set: { status: exhausted ? "dead_letter" : "queued", nextAttemptAt: exhausted ? null : new Date(Date.now() + delay), lastError: String(error.message || "Document deletion failed").slice(0, 500) }, $unset: { leaseUntil: "", leaseOwner: "" } },
    );
    if (exhausted) reportOperationalError(`Document deletion dead-lettered: ${error.message}`, { service: "document-deletion-worker", severity: "critical" });
    logger.warn("Document deletion attempt failed", { reason: error.message, exhausted });
    return { deleted: false, retryScheduled: !exhausted };
  } finally {
    clearInterval(heartbeat);
  }
}

async function startWorker() {
  const pollMs = Math.max(500, Number(process.env.DOCUMENT_DELETION_POLL_MS || 2000));
  logger.info("Document deletion worker started");
  while (true) {
    const result = await processNext();
    if (result.skipped || result.waiting) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function retryDeadLetter(id) {
  return DocumentDeletion.findOneAndUpdate(
    { _id: id, status: "dead_letter" },
    { $set: { status: "queued", attempts: 0, nextAttemptAt: new Date(), lastError: "" } },
    { new: true },
  );
}

async function listDeadLetters(limit = 100) {
  return DocumentDeletion.find({ status: "dead_letter" })
    .select("_id documentId userId reason attempts lastError createdAt updatedAt")
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit || 100), 500)))
    .lean();
}

export const documentDeletionService = { requestDeletion, processNext, startWorker, retryDeadLetter, listDeadLetters, _test: { claim } };

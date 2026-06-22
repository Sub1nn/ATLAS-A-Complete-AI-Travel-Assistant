import fs from "fs";
import crypto from "crypto";
import mongoose from "mongoose";
import { Document } from "../models/Document.js";
import { User } from "../models/User.js";
import { documentService } from "./documentService.js";
import { logger } from "../utils/logger.js";
import { vectorStore } from "./vectorStore.js";

function bucket() {
  if (!mongoose.connection.db) throw new Error("MongoDB is unavailable");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "atlas_uploads" });
}

function storeUpload(file, metadata = {}) {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(file.originalname, { contentType: file.mimetype, metadata });
    upload.on("error", reject);
    upload.on("finish", () => resolve(upload.id));
    if (file.path) {
      const source = fs.createReadStream(file.path);
      source.on("error", reject);
      source.pipe(upload);
    } else {
      upload.end(file.buffer);
    }
  });
}

function readUpload(uploadId) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = bucket().openDownloadStream(uploadId);
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function deleteUpload(uploadId) {
  if (!uploadId) return { deleted: true, absent: true };
  try {
    await bucket().delete(uploadId);
    return { deleted: true };
  } catch (error) {
    if (/FileNotFound|not found/i.test(String(error.message || ""))) return { deleted: true, absent: true };
    logger.warn("GridFS upload deletion failed", { reason: error.message });
    return { deleted: false, reason: error.message };
  }
}

async function claimDocument(documentId = null) {
  const now = new Date();
  const maxAttempts = Math.max(1, Number(process.env.DOCUMENT_MAX_PROCESSING_ATTEMPTS || 4));
  const leaseMs = Math.max(30000, Number(process.env.DOCUMENT_LEASE_MS || 5 * 60 * 1000));
  const leaseOwner = crypto.randomUUID();
  const eligible = {
    attempts: { $lt: maxAttempts },
    deletionPending: { $ne: true },
    $or: [
      { processingStatus: { $in: ["queued", "failed"] }, $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
      { processingStatus: "processing", leaseUntil: { $lte: now } },
    ],
  };
  if (documentId) eligible._id = documentId;
  return Document.findOneAndUpdate(
    eligible,
    {
      $set: { processingStatus: "processing", leaseUntil: new Date(now.getTime() + leaseMs), leaseOwner, processingError: "" },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } },
  ).select("+rawUploadId +leaseOwner");
}

async function assertDocumentOwnership(documentId, leaseOwner) {
  const owned = await Document.exists({ _id: documentId, leaseOwner, deletionPending: { $ne: true }, processingStatus: "processing" });
  if (!owned) {
    const error = new Error("Document processing lease was lost or deletion is pending");
    error.code = "DOCUMENT_LEASE_LOST";
    throw error;
  }
}

function startLeaseHeartbeat(documentId, leaseOwner) {
  const leaseMs = Math.max(30000, Number(process.env.DOCUMENT_LEASE_MS || 5 * 60 * 1000));
  const intervalMs = Math.max(10000, Math.floor(leaseMs / 3));
  const timer = setInterval(() => {
    Document.updateOne(
      { _id: documentId, leaseOwner, deletionPending: { $ne: true }, processingStatus: "processing" },
      { $set: { leaseUntil: new Date(Date.now() + leaseMs) } },
    ).catch(() => {});
  }, intervalMs);
  timer.unref();
  return timer;
}

async function processDocument(documentId = null) {
  const document = await claimDocument(documentId);
  if (!document) return { skipped: true };
  const leaseOwner = document.leaseOwner;
  const heartbeat = startLeaseHeartbeat(document._id, leaseOwner);

  try {
    const buffer = await readUpload(document.rawUploadId);
    const text = await documentService.extractText({ buffer, mimetype: document.mimeType, originalname: document.originalName });
    if (!text || text.trim().length < 20) throw new Error("Not enough readable text could be extracted");
    const boundedText = text.slice(0, Number(process.env.MAX_DOCUMENT_TEXT_CHARS || 250000));
    document.text = boundedText;
    document.chunks = documentService.chunkText(boundedText);

    await assertDocumentOwnership(document._id, leaseOwner);
    const activeUser = await User.exists({ _id: document.userId, deletionPending: { $ne: true } });
    if (!activeUser) {
      const error = new Error("Account deletion is pending");
      error.code = "DOCUMENT_LEASE_LOST";
      throw error;
    }

    const indexing = await vectorStore.upsertDocumentChunks(document, {
      shouldContinue: () => assertDocumentOwnership(document._id, leaseOwner),
    });
    await assertDocumentOwnership(document._id, leaseOwner);
    const completed = await Document.updateOne(
      { _id: document._id, leaseOwner, deletionPending: { $ne: true }, processingStatus: "processing" },
      {
        $set: {
          text: document.text,
          chunks: document.chunks,
          vectorStatus: indexing.stored ? "indexed" : indexing.status || (vectorStore.isConfigured() ? "failed" : "skipped"),
          vectorProvider: indexing.provider || document.vectorProvider,
          vectorNamespace: indexing.namespace || document.vectorNamespace,
          vectorIndexName: indexing.indexName || document.vectorIndexName,
          vectorEmbeddingModel: indexing.embeddingModel || document.vectorEmbeddingModel,
          vectorRecordCount: indexing.count || 0,
          vectorIndexedAt: indexing.stored ? new Date() : null,
          indexingError: indexing.stored ? "" : indexing.reason,
          processingStatus: "ready",
          processingError: "",
          rawCleanupPending: Boolean(document.rawUploadId),
        },
        $unset: { leaseUntil: "", leaseOwner: "", nextAttemptAt: "" },
      },
    );
    if (!completed.matchedCount) throw Object.assign(new Error("Document processing lease was lost before completion"), { code: "DOCUMENT_LEASE_LOST" });

    const cleanup = await deleteUpload(document.rawUploadId);
    if (cleanup.deleted) {
      await Document.updateOne(
        { _id: document._id, deletionPending: { $ne: true } },
        { $unset: { rawUploadId: "" }, $set: { rawCleanupPending: false } },
      );
    }
    return { processed: true, documentId: document._id.toString(), rawCleanupPending: !cleanup.deleted };
  } catch (error) {
    if (error?.code === "DOCUMENT_LEASE_LOST") {
      logger.info("Document processing stopped after lease loss or account deletion request", { documentId: document._id.toString() });
      return { processed: false, leaseLost: true, documentId: document._id.toString() };
    }
    const maxAttempts = Math.max(1, Number(process.env.DOCUMENT_MAX_PROCESSING_ATTEMPTS || 4));
    const exhausted = Number(document.attempts || 0) >= maxAttempts;
    const backoffMs = Math.min(60 * 60 * 1000, 15000 * (2 ** Math.max(0, Number(document.attempts || 1) - 1)));
    await Document.updateOne(
      { _id: document._id, leaseOwner, deletionPending: { $ne: true } },
      {
        $set: {
          processingStatus: exhausted ? "failed" : "queued",
          processingError: String(error.message || "Document processing failed").slice(0, 500),
          nextAttemptAt: exhausted ? null : new Date(Date.now() + backoffMs),
        },
        $unset: { leaseUntil: "", leaseOwner: "" },
      },
    );
    logger.warn("Document processing attempt failed", { reason: error.message, exhausted });
    return { processed: false, retryScheduled: !exhausted, documentId: document._id.toString(), reason: error.message };
  } finally {
    clearInterval(heartbeat);
  }
}

async function cleanupRawUpload() {
  const document = await Document.findOne({ processingStatus: "ready", rawCleanupPending: true, deletionPending: { $ne: true } }).select("+rawUploadId");
  if (!document) return false;
  const result = await deleteUpload(document.rawUploadId);
  if (result.deleted) {
    document.rawUploadId = undefined;
    document.rawCleanupPending = false;
    await document.save();
  }
  return true;
}

async function enqueue(documentId) {
  await Document.updateOne(
    { _id: documentId },
    { $set: { processingStatus: "queued", nextAttemptAt: new Date(), leaseUntil: null }, $setOnInsert: { attempts: 0 } },
  );
  return { queued: true, provider: "mongodb-lease" };
}

async function retry(documentId, userId) {
  return Document.findOneAndUpdate(
    { _id: documentId, userId, processingStatus: "failed", deletionPending: { $ne: true }, rawUploadId: { $exists: true } },
    { $set: { processingStatus: "queued", attempts: 0, nextAttemptAt: new Date(), processingError: "", leaseUntil: null } },
    { new: true },
  );
}

async function startWorker() {
  const pollMs = Math.max(250, Number(process.env.DOCUMENT_QUEUE_POLL_MS || 2000));
  logger.info("Durable document worker started");
  while (true) {
    const result = await processDocument();
    if (result.skipped) {
      const cleaned = await cleanupRawUpload();
      if (!cleaned) await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}

export const documentQueueService = { storeUpload, deleteUpload, enqueue, retry, processDocument, startWorker, _test: { claimDocument, assertDocumentOwnership } };

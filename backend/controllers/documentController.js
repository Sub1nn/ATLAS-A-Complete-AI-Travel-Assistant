import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { Document } from "../models/Document.js";
import { vectorStore } from "../services/vectorStore.js";
import { documentQueueService } from "../services/documentQueueService.js";
import { storageUsageService } from "../services/storageUsageService.js";
import { operationLeaseService } from "../services/operationLeaseService.js";
import { documentDeletionService } from "../services/documentDeletionService.js";

const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_BYTES || 12 * 1024 * 1024);
const MAX_USER_DOCUMENTS = Number(process.env.MAX_USER_DOCUMENTS || 100);
const MAX_USER_STORAGE_BYTES = Number(process.env.MAX_USER_STORAGE_BYTES || 150 * 1024 * 1024);

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt"]);
const UPLOAD_TMP_DIR = path.join(os.tmpdir(), "atlas-uploads");
fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });

export function extensionOf(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

export function hasAllowedSignature(file) {
  const ext = extensionOf(file.originalname);
  let buffer = file.buffer || Buffer.alloc(0);
  if (!buffer.length && file.path) {
    const fd = fs.openSync(file.path, "r");
    try {
      buffer = Buffer.alloc(8192);
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
      buffer = buffer.subarray(0, bytes);
    } finally {
      fs.closeSync(fd);
    }
  }
  if (ext === "pdf") return buffer.slice(0, 4).toString() === "%PDF";
  if (ext === "txt") return !buffer.includes(0);
  if (ext === "docx") {
    const signature = buffer.slice(0, 4).toString("hex");
    return ["504b0304", "504b0506", "504b0708"].includes(signature);
  }
  return false;
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_TMP_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}.upload`),
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = extensionOf(file.originalname);
    const ok = ALLOWED_EXTENSIONS.has(ext) && (/pdf|word|officedocument|text|plain|octet-stream/.test(file.mimetype) || ext === "txt");
    cb(ok ? null : new Error("Only PDF, DOCX and TXT files are supported"), ok);
  },
});

export const documentController = {
  async upload(req, res) {
    if (!req.file) return res.status(400).json({ message: "Please upload a PDF, DOCX or TXT file." });
    const cleanupTemp = () => req.file.path ? fs.promises.unlink(req.file.path).catch(() => {}) : Promise.resolve();
    res.once("finish", cleanupTemp);
    res.once("close", cleanupTemp);
    if (!hasAllowedSignature(req.file)) {
      await cleanupTemp();
      return res.status(400).json({ message: "The uploaded file content does not match the allowed file type." });
    }

    const reservation = await storageUsageService.reserve(req.user._id, req.file.size, {
      maxDocuments: MAX_USER_DOCUMENTS,
      maxBytes: MAX_USER_STORAGE_BYTES,
    });
    if (!reservation.allowed) {
      await cleanupTemp();
      return res.status(403).json({
        message: reservation.reason === "document_limit"
          ? "Document limit reached. Delete old files before uploading more."
          : "Storage limit reached. Delete old files before uploading more.",
      });
    }

    const safeName = String(req.file.originalname || "uploaded-file").replace(/[\\/<>:"|?*]+/g, "_").slice(0, 160);
    req.file.originalname = safeName;

    let doc;
    let operationLease = null;
    let operationHeartbeat = null;
    try {
      operationLease = await operationLeaseService.acquire(req.user._id, "upload");
      operationHeartbeat = operationLeaseService.heartbeat(operationLease);
      doc = await Document.create({
        userId: req.user._id,
        originalName: req.file.originalname,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        text: "",
        chunks: [],
        processingStatus: "queued",
        vectorStatus: vectorStore.isConfigured() ? "pending" : "skipped",
        vectorProvider: vectorStore.isConfigured() ? "pinecone" : "none",
        vectorIndexName: vectorStore.isConfigured() ? vectorStore.indexName() : undefined,
        vectorNamespace: vectorStore.isConfigured() ? vectorStore.namespaceFor(req.user._id) : undefined,
        vectorEmbeddingModel: vectorStore.isConfigured() ? vectorStore.embeddingModel() : undefined,
      });
      doc.rawUploadId = await documentQueueService.storeUpload(req.file, { userId: req.user._id.toString(), documentId: doc._id.toString() });
      await doc.save();
      await documentQueueService.enqueue(doc._id);
    } catch (error) {
      await documentQueueService.deleteUpload(doc?.rawUploadId);
      if (doc?._id) await Document.deleteOne({ _id: doc._id, userId: req.user._id });
      await storageUsageService.release(req.user._id, req.file.size);
      throw error;
    } finally {
      await operationLeaseService.release(operationLease, operationHeartbeat);
      await cleanupTemp();
    }

    res.status(202).json({
      document: {
        id: doc._id.toString(),
        name: doc.originalName,
        size: doc.size,
        chunks: 0,
        createdAt: doc.createdAt,
        processingStatus: "queued",
        vectorStore: vectorStore.isConfigured() ? "pinecone" : "local_fallback",
        vectorStatus: doc.vectorStatus,
        vectorProvider: doc.vectorProvider,
        vectorNamespace: doc.vectorNamespace,
      },
    });
  },

  async list(req, res) {
    const docs = await Document.find({ userId: req.user._id, deletionPending: { $ne: true } })
      .select("originalName size createdAt chunks processingStatus processingError attempts vectorStatus vectorProvider vectorRecordCount vectorIndexedAt indexingError")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({
      documents: docs.map((d) => ({
        id: d._id.toString(),
        name: d.originalName,
        size: d.size,
        chunks: d.chunks?.length || 0,
        createdAt: d.createdAt,
        processingStatus: d.processingStatus || "ready",
        processingError: d.processingStatus === "failed" ? d.processingError : undefined,
        processingAttempts: d.attempts || 0,
        vectorStatus: d.vectorStatus || "unknown",
        vectorProvider: d.vectorProvider || "none",
        vectorRecordCount: d.vectorRecordCount || 0,
        vectorIndexedAt: d.vectorIndexedAt,
        indexingError: d.vectorStatus === "failed" ? d.indexingError : undefined,
      })),
    });
  },

  async remove(req, res) {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id }).select("_id").lean();
    if (!doc) return res.status(404).json({ message: "Document not found" });
    await documentDeletionService.requestDeletion(doc._id, req.user._id, "user");
    res.status(202).json({ ok: true, deletionPending: true });
  },

  async retry(req, res) {
    const document = await documentQueueService.retry(req.params.id, req.user._id);
    if (!document) return res.status(409).json({ message: "This document cannot be retried. Re-upload it if the source file is no longer available." });
    res.status(202).json({ document: { id: document._id.toString(), processingStatus: document.processingStatus } });
  },
};

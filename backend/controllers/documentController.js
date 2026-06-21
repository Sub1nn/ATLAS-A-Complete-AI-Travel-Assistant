import multer from "multer";
import { Document } from "../models/Document.js";
import { documentService } from "../services/documentService.js";
import { vectorStore } from "../services/vectorStore.js";
import { Conversation } from "../models/Conversation.js";

const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_BYTES || 12 * 1024 * 1024);
const MAX_USER_DOCUMENTS = Number(process.env.MAX_USER_DOCUMENTS || 100);
const MAX_USER_STORAGE_BYTES = Number(process.env.MAX_USER_STORAGE_BYTES || 150 * 1024 * 1024);

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt"]);

export function extensionOf(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

export function hasAllowedSignature(file) {
  const ext = extensionOf(file.originalname);
  const buffer = file.buffer || Buffer.alloc(0);
  if (ext === "pdf") return buffer.slice(0, 4).toString() === "%PDF";
  if (ext === "txt") return !buffer.includes(0);
  if (ext === "docx") {
    const signature = buffer.slice(0, 4).toString("hex");
    return ["504b0304", "504b0506", "504b0708"].includes(signature);
  }
  return false;
}

export const upload = multer({
  storage: multer.memoryStorage(),
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
    if (!hasAllowedSignature(req.file)) {
      return res.status(400).json({ message: "The uploaded file content does not match the allowed file type." });
    }

    const [count, storage] = await Promise.all([
      Document.countDocuments({ userId: req.user._id }),
      Document.aggregate([
        { $match: { userId: req.user._id } },
        { $group: { _id: null, total: { $sum: "$size" } } },
      ]),
    ]);

    const usedBytes = storage[0]?.total || 0;
    if (count >= MAX_USER_DOCUMENTS) return res.status(403).json({ message: "Document limit reached. Delete old files before uploading more." });
    if (usedBytes + req.file.size > MAX_USER_STORAGE_BYTES) return res.status(403).json({ message: "Storage limit reached. Delete old files before uploading more." });

    const safeName = String(req.file.originalname || "uploaded-file").replace(/[\\/<>:"|?*]+/g, "_").slice(0, 160);
    req.file.originalname = safeName;

    const text = await documentService.extractText(req.file);
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ message: "I could not extract enough readable text from this file." });
    }

    const maxTextChars = Number(process.env.MAX_DOCUMENT_TEXT_CHARS || 250000);
    const boundedText = text.slice(0, maxTextChars);
    const doc = await Document.create({
      userId: req.user._id,
      originalName: req.file.originalname,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      text: boundedText,
      chunks: documentService.chunkText(boundedText),
      vectorStatus: vectorStore.isConfigured() ? "pending" : "skipped",
      vectorProvider: vectorStore.isConfigured() ? "pinecone" : "none",
      vectorIndexName: vectorStore.isConfigured() ? vectorStore.indexName() : undefined,
      vectorNamespace: vectorStore.isConfigured() ? vectorStore.namespaceFor(req.user._id) : undefined,
      vectorEmbeddingModel: vectorStore.isConfigured() ? vectorStore.embeddingModel() : undefined,
    });

    const indexing = await vectorStore.upsertDocumentChunks(doc);
    doc.vectorStatus = indexing.stored ? "indexed" : indexing.status || (vectorStore.isConfigured() ? "failed" : "skipped");
    doc.vectorProvider = indexing.provider || doc.vectorProvider;
    doc.vectorNamespace = indexing.namespace || doc.vectorNamespace;
    doc.vectorIndexName = indexing.indexName || doc.vectorIndexName;
    doc.vectorEmbeddingModel = indexing.embeddingModel || doc.vectorEmbeddingModel;
    doc.vectorRecordCount = indexing.count || 0;
    doc.vectorIndexedAt = indexing.stored ? new Date() : undefined;
    doc.indexingError = indexing.stored ? undefined : indexing.reason;
    await doc.save();

    res.status(201).json({
      document: {
        id: doc._id.toString(),
        name: doc.originalName,
        size: doc.size,
        chunks: doc.chunks.length,
        createdAt: doc.createdAt,
        vectorStore: indexing.stored ? "pinecone" : "local_fallback",
        vectorStatus: doc.vectorStatus,
        vectorProvider: doc.vectorProvider,
        vectorNamespace: doc.vectorNamespace,
        indexingError: doc.vectorStatus === "failed" ? doc.indexingError : undefined,
      },
    });
  },

  async list(req, res) {
    const docs = await Document.find({ userId: req.user._id })
      .select("originalName size createdAt chunks vectorStatus vectorProvider vectorRecordCount vectorIndexedAt indexingError")
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
        vectorStatus: d.vectorStatus || "unknown",
        vectorProvider: d.vectorProvider || "none",
        vectorRecordCount: d.vectorRecordCount || 0,
        vectorIndexedAt: d.vectorIndexedAt,
        indexingError: d.vectorStatus === "failed" ? d.indexingError : undefined,
      })),
    });
  },

  async remove(req, res) {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id }).select("_id userId chunks vectorNamespace").lean();
    if (!doc) return res.status(404).json({ message: "Document not found" });
    await vectorStore.deleteDocumentChunks({ userId: req.user._id, documentId: doc._id, chunkCount: doc.chunks?.length || 0 });
    await Promise.all([
      Document.deleteOne({ _id: req.params.id, userId: req.user._id }),
      Conversation.updateMany({ userId: req.user._id, documentIds: doc._id }, { $pull: { documentIds: doc._id } }),
    ]);
    res.json({ ok: true });
  },
};

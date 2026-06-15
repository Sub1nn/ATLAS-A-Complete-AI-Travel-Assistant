import multer from "multer";
import { Document } from "../models/Document.js";
import { documentService } from "../services/documentService.js";

const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_BYTES || 12 * 1024 * 1024);
const MAX_USER_DOCUMENTS = Number(process.env.MAX_USER_DOCUMENTS || 100);
const MAX_USER_STORAGE_BYTES = Number(process.env.MAX_USER_STORAGE_BYTES || 150 * 1024 * 1024);

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt"]);

function extensionOf(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

function hasAllowedSignature(file) {
  const ext = extensionOf(file.originalname);
  const buffer = file.buffer || Buffer.alloc(0);
  if (ext === "pdf") return buffer.slice(0, 4).toString() === "%PDF";
  if (ext === "txt") return true;
  if (ext === "docx") return buffer.slice(0, 2).toString("hex") === "504b";
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

    const doc = await Document.create({
      userId: req.user._id,
      originalName: req.file.originalname,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      text: text.slice(0, Number(process.env.MAX_DOCUMENT_TEXT_CHARS || 250000)),
      chunks: documentService.chunkText(text),
    });

    res.status(201).json({
      document: {
        id: doc._id.toString(),
        name: doc.originalName,
        size: doc.size,
        chunks: doc.chunks.length,
        createdAt: doc.createdAt,
      },
    });
  },

  async list(req, res) {
    const docs = await Document.find({ userId: req.user._id })
      .select("originalName size createdAt chunks")
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
      })),
    });
  },

  async remove(req, res) {
    const result = await Document.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (!result.deletedCount) return res.status(404).json({ message: "Document not found" });
    res.json({ ok: true });
  },
};

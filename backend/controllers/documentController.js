import multer from "multer";
import { Document } from "../models/Document.js";
import { documentService } from "../services/documentService.js";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /pdf|word|officedocument|text/.test(file.mimetype) || /\.(pdf|docx|txt)$/i.test(file.originalname);
    cb(ok ? null : new Error("Only PDF, DOCX and TXT files are supported"), ok);
  },
});

export const documentController = {
  async upload(req, res) {
    if (!req.file) return res.status(400).json({ message: "Please upload a PDF, DOCX or TXT file." });
    const safeName = String(req.file.originalname || "uploaded-file").replace(/[\/<>:"|?*]+/g, "_").slice(0, 160);
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
      text: text.slice(0, 250000),
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
      .limit(50)
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
    await Document.deleteOne({ _id: req.params.id, userId: req.user._id });
    res.json({ ok: true });
  },
};

import mongoose from "mongoose";

const ChunkSchema = new mongoose.Schema(
  {
    index: Number,
    text: String,
    keywords: [String],
    // Legacy field kept for backward compatibility with documents created before
    // Pinecone semantic retrieval was added. New uploads no longer store vectors in MongoDB.
    embedding: { type: [Number], select: false },
  },
  { _id: false },
);

const DocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: String,
    fileName: String,
    mimeType: String,
    size: Number,
    text: String,
    chunks: [ChunkSchema],
    processingStatus: { type: String, enum: ["queued", "processing", "ready", "failed"], default: "queued", index: true },
    processingError: String,
    attempts: { type: Number, default: 0 },
    leaseUntil: Date,
    leaseOwner: { type: String, select: false },
    nextAttemptAt: Date,
    deletionPending: { type: Boolean, default: false, index: true },
    rawCleanupPending: { type: Boolean, default: false },
    rawUploadId: { type: mongoose.Schema.Types.ObjectId, select: false },
    vectorStatus: {
      type: String,
      enum: ["pending", "indexed", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    vectorProvider: { type: String, default: "pinecone" },
    vectorIndexName: String,
    vectorNamespace: String,
    vectorRecordCount: { type: Number, default: 0 },
    vectorEmbeddingModel: String,
    vectorIndexedAt: Date,
    indexingError: String,
  },
  { timestamps: true },
);

DocumentSchema.index({ userId: 1, createdAt: -1 });
DocumentSchema.index({ userId: 1, originalName: 1 });
DocumentSchema.index({ userId: 1, vectorStatus: 1, createdAt: -1 });
DocumentSchema.index({ processingStatus: 1, createdAt: 1 });
DocumentSchema.index({ processingStatus: 1, nextAttemptAt: 1, leaseUntil: 1 });
DocumentSchema.index({ userId: 1, deletionPending: 1, processingStatus: 1, leaseUntil: 1 });

export const Document = mongoose.models.Document || mongoose.model("Document", DocumentSchema);

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

export const Document = mongoose.models.Document || mongoose.model("Document", DocumentSchema);

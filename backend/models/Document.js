import mongoose from "mongoose";

const ChunkSchema = new mongoose.Schema(
  {
    index: Number,
    text: String,
    keywords: [String],
    embedding: [Number],
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
  },
  { timestamps: true },
);

DocumentSchema.index({ userId: 1, createdAt: -1 });
DocumentSchema.index({ userId: 1, originalName: 1 });

export const Document = mongoose.models.Document || mongoose.model("Document", DocumentSchema);

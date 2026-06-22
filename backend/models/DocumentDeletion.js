import mongoose from "mongoose";

const DocumentDeletionSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, enum: ["user", "retention", "account"], default: "user" },
    status: { type: String, enum: ["queued", "processing", "failed", "dead_letter"], default: "queued", index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: Date,
    leaseUntil: Date,
    leaseOwner: { type: String, select: false },
    lastError: { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

DocumentDeletionSchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });

export const DocumentDeletion = mongoose.models.DocumentDeletion || mongoose.model("DocumentDeletion", DocumentDeletionSchema);

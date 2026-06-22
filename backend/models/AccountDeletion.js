import mongoose from "mongoose";

const AccountDeletionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true, index: true },
    trackingTokenHash: { type: String, required: true, unique: true, select: false },
    notificationEmail: { type: String, select: false },
    status: { type: String, enum: ["queued", "processing", "failed", "dead_letter", "completed"], default: "queued", index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: Date,
    leaseUntil: Date,
    leaseOwner: { type: String, select: false },
    lastError: { type: String, maxlength: 500, default: "" },
    completedAt: Date,
    expiresAt: Date,
  },
  { timestamps: true },
);

AccountDeletionSchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
AccountDeletionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AccountDeletion = mongoose.models.AccountDeletion || mongoose.model("AccountDeletion", AccountDeletionSchema);

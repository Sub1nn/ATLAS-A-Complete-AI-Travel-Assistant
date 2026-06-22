import mongoose from "mongoose";

const AccountDeletionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
    status: { type: String, enum: ["queued", "processing", "failed"], default: "queued", index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: Date,
    leaseUntil: Date,
    leaseOwner: { type: String, select: false },
    lastError: { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

AccountDeletionSchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });

export const AccountDeletion = mongoose.models.AccountDeletion || mongoose.model("AccountDeletion", AccountDeletionSchema);

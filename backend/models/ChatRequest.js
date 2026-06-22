import mongoose from "mongoose";

const ChatRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientRequestId: { type: String, required: true },
    status: { type: String, enum: ["processing", "completed", "failed"], default: "processing", index: true },
    response: { type: mongoose.Schema.Types.Mixed, default: undefined },
    failureReason: { type: String, maxlength: 300, default: "" },
    processingOwner: { type: String, select: false },
    processingLeaseUntil: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

ChatRequestSchema.index({ userId: 1, clientRequestId: 1 }, { unique: true });
ChatRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ChatRequestSchema.index({ status: 1, processingLeaseUntil: 1 });

export const ChatRequest = mongoose.models.ChatRequest || mongoose.model("ChatRequest", ChatRequestSchema);

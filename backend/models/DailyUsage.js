import mongoose from "mongoose";

const DailyUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    chatRequests: { type: Number, default: 0 },
    toolCalls: { type: Number, default: 0 },
    providerCalls: { type: Number, default: 0 },
    llmCalls: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

DailyUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
DailyUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DailyUsage = mongoose.models.DailyUsage || mongoose.model("DailyUsage", DailyUsageSchema);

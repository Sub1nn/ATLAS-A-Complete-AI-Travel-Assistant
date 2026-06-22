import mongoose from "mongoose";

const GlobalUsageSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true },
    providerCalls: { type: Number, default: 0 },
    llmCalls: { type: Number, default: 0 },
    providerAlerted: { type: Boolean, default: false },
    llmAlerted: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

GlobalUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GlobalUsage = mongoose.models.GlobalUsage || mongoose.model("GlobalUsage", GlobalUsageSchema);

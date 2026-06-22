import mongoose from "mongoose";

const StorageUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
    documentCount: { type: Number, default: 0, min: 0 },
    bytes: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const StorageUsage = mongoose.models.StorageUsage || mongoose.model("StorageUsage", StorageUsageSchema);

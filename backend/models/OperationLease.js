import mongoose from "mongoose";

const OperationLeaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    owner: { type: String, required: true, unique: true },
    type: { type: String, enum: ["chat", "upload"], required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

OperationLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OperationLeaseSchema.index({ userId: 1, expiresAt: 1 });

export const OperationLease = mongoose.models.OperationLease || mongoose.model("OperationLease", OperationLeaseSchema);

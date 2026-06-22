import mongoose from "mongoose";

const WorkerHeartbeatSchema = new mongoose.Schema(
  {
    workerName: { type: String, required: true },
    instanceId: { type: String, required: true },
    lastSeenAt: { type: Date, required: true, index: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

WorkerHeartbeatSchema.index({ workerName: 1, instanceId: 1 }, { unique: true });
WorkerHeartbeatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WorkerHeartbeat = mongoose.models.WorkerHeartbeat || mongoose.model("WorkerHeartbeat", WorkerHeartbeatSchema);

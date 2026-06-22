import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true, select: false },
    tokenVersion: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    revokedAt: Date,
    revokedReason: { type: String, enum: ["rotated", "logout", "security", "expired"], default: undefined },
  },
  { timestamps: true },
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

export const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);

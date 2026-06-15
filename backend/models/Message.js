import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 12000 },
    intent: { type: String, default: "" },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true },
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ userId: 1, createdAt: -1 });

export const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

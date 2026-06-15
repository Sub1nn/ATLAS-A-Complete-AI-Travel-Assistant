import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    intent: String,
    metadata: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New travel chat", maxlength: 120 },
    // Legacy field retained for backward compatibility with older local data. New messages are stored in Message collection.
    messages: { type: [MessageSchema], default: [] },
    summary: { type: String, default: "", maxlength: 4000 },
    lastMessagePreview: { type: String, default: "", maxlength: 180 },
    messageCount: { type: Number, default: 0 },
    memory: {
      destination: String,
      locations: [String],
      travelDates: [String],
      budget: String,
      interests: [String],
      groupType: String,
      lastIntent: String,
      lastTopic: String,
      area: String,
    },
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
  },
  { timestamps: true },
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });
ConversationSchema.index({ userId: 1, createdAt: -1 });

export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

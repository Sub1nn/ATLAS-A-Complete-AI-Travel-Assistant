import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    intent: String,
    metadata: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New travel chat", maxlength: 120 },
    messages: [MessageSchema],
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
  { timestamps: true }
);

export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

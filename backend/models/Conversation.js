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

const RouteMemorySchema = new mongoose.Schema(
  {
    origin: { type: String, default: "" },
    destination: { type: String, default: "" },
    mode: { type: String, default: "transit" },
  },
  { _id: false },
);

const PendingActivitySchema = new mongoose.Schema(
  {
    activity: { type: String, default: "" },
    activityLabel: { type: String, default: "" },
    location: { type: String, default: "" },
    date: { type: String, default: "" },
    targetDate: { type: String, default: "" },
  },
  { _id: false },
);

const ConversationMemorySchema = new mongoose.Schema(
  {
    destination: String,
    country: String,
    locationScope: { type: String, enum: ["city", "country", "region", "unknown"] },
    locations: { type: [String], default: [] },
    travelDates: { type: [String], default: [] },
    budget: String,
    interests: { type: [String], default: [] },
    groupType: String,
    lastIntent: String,
    lastTopic: String,
    area: String,
    stayType: String,
    diningStyle: String,
    lastAcceptedOffer: String,
    route: { type: RouteMemorySchema, default: undefined },
    pendingActivitySearch: { type: PendingActivitySchema, default: undefined },
  },
  { _id: false },
);

const MEMORY_SCALAR_FIELDS = [
  "destination", "country", "locationScope", "budget", "groupType", "lastIntent",
  "lastTopic", "area", "stayType", "diningStyle", "lastAcceptedOffer",
];

export function normalizeConversationMemory(memory = {}) {
  const source = typeof memory?.toObject === "function" ? memory.toObject() : memory || {};
  const normalized = {
    locations: Array.isArray(source.locations) ? source.locations.filter(Boolean).map(String).slice(-8) : [],
    travelDates: Array.isArray(source.travelDates) ? source.travelDates.filter(Boolean).map(String).slice(-6) : [],
    interests: Array.isArray(source.interests) ? source.interests.filter(Boolean).map(String).slice(-12) : [],
  };

  for (const field of MEMORY_SCALAR_FIELDS) {
    if (source[field] !== undefined && source[field] !== null && source[field] !== "") {
      normalized[field] = String(source[field]);
    }
  }

  if (source.route && typeof source.route === "object" && source.route.origin && source.route.destination) {
    normalized.route = {
      origin: String(source.route.origin),
      destination: String(source.route.destination),
      mode: String(source.route.mode || "transit"),
    };
  }

  if (source.pendingActivitySearch && typeof source.pendingActivitySearch === "object" && source.pendingActivitySearch.activity) {
    normalized.pendingActivitySearch = {
      activity: String(source.pendingActivitySearch.activity),
      activityLabel: String(source.pendingActivitySearch.activityLabel || source.pendingActivitySearch.activity),
      location: String(source.pendingActivitySearch.location || ""),
      date: String(source.pendingActivitySearch.date || ""),
      targetDate: String(source.pendingActivitySearch.targetDate || ""),
    };
  }

  return normalized;
}

const ConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New travel chat", maxlength: 120 },
    // Legacy field retained for backward compatibility with older local data. New messages are stored in Message collection.
    messages: { type: [MessageSchema], default: [] },
    summary: { type: String, default: "", maxlength: 4000 },
    lastMessagePreview: { type: String, default: "", maxlength: 180 },
    messageCount: { type: Number, default: 0 },
    memory: { type: ConversationMemorySchema, default: () => ({}) },
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
  },
  { timestamps: true },
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });
ConversationSchema.index({ userId: 1, createdAt: -1 });

export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

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
    departureTime: { type: String, default: "" },
    arrivalTime: { type: String, default: "" },
    dateLabel: { type: String, default: "" },
    targetDate: { type: String, default: "" },
  },
  { _id: false },
);

const RequestConstraintsSchema = new mongoose.Schema(
  {
    accessible: Boolean,
    senior: Boolean,
    minimalWalking: Boolean,
    minimalTransfers: Boolean,
    noCar: Boolean,
    indoorAlternative: Boolean,
    indoorPreferred: Boolean,
    rainAlternative: Boolean,
    dietary: { type: [String], default: undefined },
    maxBudget: Number,
    dayCount: Number,
    currency: String,
    startTime: String,
    checkIn: String,
    checkOut: String,
    adults: Number,
    childAges: { type: [Number], default: undefined },
    roomQuantity: Number,
    breakfastPreferred: Boolean,
    focus: String,
    origin: String,
    exclusions: { type: [String], default: undefined },
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

const LayoverMemorySchema = new mongoose.Schema(
  {
    airport: { type: String, default: "" },
    durationMinutes: Number,
    arrivalTerminal: { type: String, default: "" },
    departureTerminal: { type: String, default: "" },
    cabinLuggage: Boolean,
    checkedThrough: Boolean,
    sameTicket: Boolean,
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
    targetDate: String,
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
    layover: { type: LayoverMemorySchema, default: undefined },
    constraints: { type: RequestConstraintsSchema, default: undefined },
  },
  { _id: false },
);

const MEMORY_SCALAR_FIELDS = [
  "destination", "country", "locationScope", "budget", "groupType", "lastIntent",
  "lastTopic", "area", "stayType", "diningStyle", "lastAcceptedOffer", "targetDate",
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
      departureTime: String(source.route.departureTime || ""),
      arrivalTime: String(source.route.arrivalTime || ""),
      dateLabel: String(source.route.dateLabel || ""),
      targetDate: String(source.route.targetDate || ""),
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

  if (source.layover && typeof source.layover === "object" && source.layover.airport) {
    normalized.layover = {
      airport: String(source.layover.airport).slice(0, 160),
      durationMinutes: Number.isFinite(Number(source.layover.durationMinutes)) ? Number(source.layover.durationMinutes) : undefined,
      arrivalTerminal: String(source.layover.arrivalTerminal || "").slice(0, 40),
      departureTerminal: String(source.layover.departureTerminal || "").slice(0, 40),
      cabinLuggage: Boolean(source.layover.cabinLuggage),
      checkedThrough: Boolean(source.layover.checkedThrough),
      sameTicket: Boolean(source.layover.sameTicket),
    };
  }

  if (source.constraints && typeof source.constraints === "object") {
    const constraints = {};
    const booleanFields = ["accessible", "senior", "minimalWalking", "minimalTransfers", "noCar", "indoorAlternative", "indoorPreferred", "rainAlternative", "breakfastPreferred"];
    for (const field of booleanFields) {
      if (typeof source.constraints[field] === "boolean") constraints[field] = source.constraints[field];
    }
    for (const field of ["maxBudget", "dayCount", "adults", "roomQuantity"]) {
      const value = Number(source.constraints[field]);
      if (Number.isFinite(value) && value >= 0) constraints[field] = value;
    }
    for (const field of ["currency", "startTime", "checkIn", "checkOut", "focus", "origin"]) {
      if (source.constraints[field]) constraints[field] = String(source.constraints[field]).slice(0, 120);
    }
    constraints.dietary = Array.isArray(source.constraints.dietary)
      ? source.constraints.dietary.filter(Boolean).map(String).slice(0, 8)
      : [];
    constraints.childAges = Array.isArray(source.constraints.childAges)
      ? source.constraints.childAges.map(Number).filter((value) => Number.isFinite(value) && value >= 0 && value <= 17).slice(0, 8)
      : [];
    constraints.exclusions = Array.isArray(source.constraints.exclusions)
      ? source.constraints.exclusions.filter(Boolean).map(String).slice(0, 8)
      : [];
    normalized.constraints = constraints;
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
    processingOwner: { type: String, select: false },
    processingLeaseUntil: { type: Date, select: false },
  },
  { timestamps: true },
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });
ConversationSchema.index({ userId: 1, createdAt: -1 });
ConversationSchema.index({ processingLeaseUntil: 1 });

export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

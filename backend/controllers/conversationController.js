import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { titleSchema, validate } from "../utils/validation.js";
import { deleteAtlasConversationThread, deleteAtlasUserThreads } from "../agents/atlasGraph.js";

function pageLimit(value, fallback, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, max)) : fallback;
}

function parseCursor(value) {
  if (!value) return null;
  const [dateValue, id] = String(value).split("|");
  const date = new Date(dateValue);
  if (!dateValue || Number.isNaN(date.getTime()) || !/^[a-fA-F0-9]{24}$/.test(id || "")) return null;
  return { date, id };
}

function cursorFilter(field, cursor) {
  if (!cursor) return {};
  return { $or: [{ [field]: { $lt: cursor.date } }, { [field]: cursor.date, _id: { $lt: cursor.id } }] };
}

function makeCursor(item, field) {
  return item ? `${new Date(item[field]).toISOString()}|${item._id}` : null;
}

export const conversationController = {
  async list(req, res) {
    const limit = pageLimit(req.query.limit, 25, 50);
    const cursor = parseCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid conversation cursor" });
    const rows = await Conversation.find({ userId: req.user._id, ...cursorFilter("updatedAt", cursor) })
      .select("title updatedAt createdAt memory lastMessagePreview messageCount documentIds")
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const conversations = rows.slice(0, limit);

    res.json({
      conversations: conversations.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        preview: c.lastMessagePreview || "",
        messageCount: c.messageCount || 0,
        documentCount: c.documentIds?.length || 0,
      })),
      nextCursor: hasMore ? makeCursor(conversations.at(-1), "updatedAt") : null,
    });
  },

  async create(req, res) {
    const parsed = validate(titleSchema, req.body?.title);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const conversation = await Conversation.create({
      userId: req.user._id,
      title: parsed.data || "New travel chat",
      memory: { locations: [], interests: [], travelDates: [] },
      lastMessagePreview: "",
      messageCount: 0,
    });
    res.status(201).json({ conversation: { id: conversation._id.toString(), title: conversation.title } });
  },

  async get(req, res) {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    const limit = pageLimit(req.query.limit, 100, 200);
    const cursor = parseCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: "Invalid message cursor" });
    const messageRows = await Message.find({ conversationId: conversation._id, userId: req.user._id, ...cursorFilter("createdAt", cursor) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMoreMessages = messageRows.length > limit;
    const pageRows = messageRows.slice(0, limit);
    const storedMessages = [...pageRows].reverse();

    const legacyMessages = conversation.messages || [];
    const messages = storedMessages.length ? storedMessages : !cursor ? legacyMessages : [];

    res.json({
      conversation: {
        id: conversation._id.toString(),
        title: conversation.title,
        memory: conversation.memory,
        summary: conversation.summary || "",
        documentIds: conversation.documentIds?.map(String) || [],
        messages: messages.map((m) => ({
          id: m._id?.toString(),
          type: m.role === "user" ? "user" : "assistant",
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          metadata: m.metadata || {},
        })),
        nextMessageCursor: hasMoreMessages ? makeCursor(pageRows.at(-1), "createdAt") : null,
      },
    });
  },

  async clearAll(req, res) {
    const conversations = await Conversation.find({ userId: req.user._id }).select("_id").lean();
    await deleteAtlasUserThreads(req.user._id, conversations.map((conversation) => conversation._id));
    const [messagesResult, conversationsResult] = await Promise.all([
      Message.deleteMany({ userId: req.user._id }),
      Conversation.deleteMany({ userId: req.user._id }),
    ]);
    res.json({ ok: true, deletedCount: conversationsResult.deletedCount || 0, deletedMessages: messagesResult.deletedCount || 0 });
  },

  async remove(req, res) {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id }).select("_id").lean();
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    await deleteAtlasConversationThread(req.user._id, conversation._id);
    await Promise.all([
      Message.deleteMany({ conversationId: conversation._id, userId: req.user._id }),
      Conversation.deleteOne({ _id: conversation._id, userId: req.user._id }),
    ]);
    res.json({ ok: true });
  },
};

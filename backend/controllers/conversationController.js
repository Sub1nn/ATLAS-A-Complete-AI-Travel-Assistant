import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { titleSchema, validate } from "../utils/validation.js";

export const conversationController = {
  async list(req, res) {
    const conversations = await Conversation.find({ userId: req.user._id })
      .select("title updatedAt createdAt memory lastMessagePreview messageCount documentIds")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

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

    const storedMessages = await Message.find({ conversationId: conversation._id, userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean()
      .then((items) => items.reverse());

    const legacyMessages = conversation.messages || [];
    const messages = storedMessages.length ? storedMessages : legacyMessages;

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
      },
    });
  },

  async clearAll(req, res) {
    const [messagesResult, conversationsResult] = await Promise.all([
      Message.deleteMany({ userId: req.user._id }),
      Conversation.deleteMany({ userId: req.user._id }),
    ]);
    res.json({ ok: true, deletedCount: conversationsResult.deletedCount || 0, deletedMessages: messagesResult.deletedCount || 0 });
  },

  async remove(req, res) {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id }).select("_id").lean();
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    await Promise.all([
      Message.deleteMany({ conversationId: conversation._id, userId: req.user._id }),
      Conversation.deleteOne({ _id: conversation._id, userId: req.user._id }),
    ]);
    res.json({ ok: true });
  },
};

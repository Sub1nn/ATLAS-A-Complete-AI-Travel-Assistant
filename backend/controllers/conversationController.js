import { Conversation } from "../models/Conversation.js";

export const conversationController = {
  async list(req, res) {
    const conversations = await Conversation.find({ userId: req.user._id })
      .select("title updatedAt createdAt memory messages")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    res.json({
      conversations: conversations.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        preview: c.messages?.at(-1)?.content?.slice(0, 140) || "",
        messageCount: c.messages?.length || 0,
      })),
    });
  },

  async create(req, res) {
    const conversation = await Conversation.create({
      userId: req.user._id,
      title: req.body?.title || "New travel chat",
      messages: [],
      memory: { locations: [], interests: [], travelDates: [] },
    });
    res.status(201).json({ conversation: { id: conversation._id.toString(), title: conversation.title } });
  },

  async get(req, res) {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    res.json({
      conversation: {
        id: conversation._id.toString(),
        title: conversation.title,
        memory: conversation.memory,
        documentIds: conversation.documentIds?.map(String) || [],
        messages: (conversation.messages || []).map((m) => ({
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
    const result = await Conversation.deleteMany({ userId: req.user._id });
    res.json({ ok: true, deletedCount: result.deletedCount || 0 });
  },

  async remove(req, res) {
    await Conversation.deleteOne({ _id: req.params.id, userId: req.user._id });
    res.json({ ok: true });
  },
};

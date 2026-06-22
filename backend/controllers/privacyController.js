import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Document } from "../models/Document.js";
import { Message } from "../models/Message.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { sessionService } from "../services/sessionService.js";
import { accountDeletionService } from "../services/accountDeletionService.js";
import { accountDeleteSchema, retentionSettingsSchema, validate } from "../utils/validation.js";

async function writeChunk(res, chunk) {
  if (res.destroyed) return false;
  if (!res.write(chunk)) {
    await new Promise((resolve) => {
      const done = () => {
        res.off("drain", done);
        res.off("close", done);
        resolve();
      };
      res.once("drain", done);
      res.once("close", done);
    });
  }
  return !res.destroyed;
}

async function streamArray(res, cursor, transform = (value) => value) {
  let first = true;
  for await (const document of cursor) {
    if (!(await writeChunk(res, `${first ? "" : ","}${JSON.stringify(transform(document.toObject ? document.toObject() : document))}`))) break;
    first = false;
  }
}

export const privacyController = {
  async exportData(req, res) {
    const user = await User.findById(req.user._id).lean();
    const account = user ? {
      id: user._id, name: user.name, email: user.email, emailVerified: user.emailVerified,
      preferences: user.preferences, legalAcceptance: user.legalAcceptance,
      dataRetentionDays: user.dataRetentionDays, createdAt: user.createdAt, updatedAt: user.updatedAt,
    } : null;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="atlas-data-export-${new Date().toISOString().slice(0, 10)}.json"`);
    await writeChunk(res, `{"exportedAt":${JSON.stringify(new Date().toISOString())},"formatVersion":1,"account":${JSON.stringify(account)},"conversations":[`);
    await streamArray(res, Conversation.find({ userId: req.user._id }).sort({ createdAt: 1 }).cursor());
    await writeChunk(res, `],"messages":[`);
    await streamArray(res, Message.find({ userId: req.user._id }).sort({ createdAt: 1 }).cursor());
    await writeChunk(res, `],"documents":[`);
    await streamArray(
      res,
      Document.find({ userId: req.user._id }).select("originalName mimeType size text vectorStatus processingStatus createdAt updatedAt").sort({ createdAt: 1 }).cursor(),
      (document) => ({
        id: document._id, originalName: document.originalName, mimeType: document.mimeType,
        size: document.size, text: document.text, vectorStatus: document.vectorStatus,
        processingStatus: document.processingStatus, createdAt: document.createdAt, updatedAt: document.updatedAt,
      }),
    );
    if (!res.destroyed) res.end("]}");
  },

  async updateRetention(req, res) {
    const parsed = validate(retentionSettingsSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    req.user.dataRetentionDays = parsed.data.dataRetentionDays;
    await req.user.save();
    res.json({ dataRetentionDays: req.user.dataRetentionDays });
  },

  async deleteAccount(req, res) {
    const parsed = validate(accountDeleteSchema, req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ message: "Password confirmation failed" });
    }

    const queueDeletion = async (session = null) => {
      const options = session ? { session } : undefined;
      await User.updateOne(
        { _id: user._id },
        { $set: { deletionPending: true, deletionRequestedAt: new Date() }, $inc: { tokenVersion: 1 } },
        options,
      );
      await Document.updateMany({ userId: user._id }, { $set: { deletionPending: true } }, options);
      await Session.deleteMany({ userId: user._id }, options);
      await accountDeletionService.enqueue(user._id, session);
    };

    if (process.env.MONGODB_TRANSACTIONS === "true") {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(() => queueDeletion(session));
      } finally {
        await session.endSession();
      }
    } else {
      await queueDeletion();
    }
    sessionService.clearCookie(res);
    res.status(202).json({ ok: true, deletionPending: true, message: "Account deletion was accepted and is being completed safely." });
  },
};

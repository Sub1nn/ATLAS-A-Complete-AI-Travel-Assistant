import crypto from "crypto";
import mongoose from "mongoose";
import { AccountDeletion } from "../models/AccountDeletion.js";
import { ChatRequest } from "../models/ChatRequest.js";
import { Conversation } from "../models/Conversation.js";
import { DailyUsage } from "../models/DailyUsage.js";
import { Document } from "../models/Document.js";
import { Message } from "../models/Message.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { StorageUsage } from "../models/StorageUsage.js";
import { documentQueueService } from "./documentQueueService.js";
import { vectorStore } from "./vectorStore.js";
import { logger } from "../utils/logger.js";

const leaseMs = () => Math.max(60000, Number(process.env.ACCOUNT_DELETION_LEASE_MS || 10 * 60 * 1000));
const maxAttempts = () => Math.max(1, Number(process.env.ACCOUNT_DELETION_MAX_ATTEMPTS || 20));

async function enqueue(userId, mongoSession = null) {
  try {
    return await AccountDeletion.findOneAndUpdate(
      { userId },
      {
        $set: { status: "queued", nextAttemptAt: new Date(), lastError: "" },
        $unset: { leaseUntil: "", leaseOwner: "" },
        $setOnInsert: { attempts: 0 },
      },
      { upsert: true, new: true, ...(mongoSession ? { session: mongoSession } : {}) },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return AccountDeletion.findOne({ userId }).session(mongoSession || null);
  }
}

async function claim() {
  const now = new Date();
  const leaseOwner = crypto.randomUUID();
  return AccountDeletion.findOneAndUpdate(
    {
      attempts: { $lt: maxAttempts() },
      $or: [
        { status: { $in: ["queued", "failed"] }, $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
        { status: "processing", leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: { status: "processing", leaseOwner, leaseUntil: new Date(now.getTime() + leaseMs()), lastError: "" },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } },
  ).select("+leaseOwner");
}

function startHeartbeat(job) {
  const timer = setInterval(() => {
    AccountDeletion.updateOne(
      { _id: job._id, leaseOwner: job.leaseOwner, status: "processing" },
      { $set: { leaseUntil: new Date(Date.now() + leaseMs()) } },
    ).catch(() => {});
  }, Math.max(15000, Math.floor(leaseMs() / 3)));
  timer.unref();
  return timer;
}

async function deleteLocalRecords(job, session = null) {
  const options = session ? { session } : undefined;
  await Message.deleteMany({ userId: job.userId }, options);
  await Conversation.deleteMany({ userId: job.userId }, options);
  await Document.deleteMany({ userId: job.userId }, options);
  await Session.deleteMany({ userId: job.userId }, options);
  await ChatRequest.deleteMany({ userId: job.userId }, options);
  await DailyUsage.deleteMany({ userId: job.userId }, options);
  await StorageUsage.deleteMany({ userId: job.userId }, options);
  await User.deleteOne({ _id: job.userId }, options);
  await AccountDeletion.deleteOne({ _id: job._id, leaseOwner: job.leaseOwner }, options);
}

async function processNext() {
  const job = await claim();
  if (!job) return { skipped: true };
  const heartbeat = startHeartbeat(job);
  try {
    await Document.updateMany({ userId: job.userId }, { $set: { deletionPending: true } });
    const now = new Date();
    const [activeDocuments, activeConversations, userActivity] = await Promise.all([
      Document.countDocuments({
        userId: job.userId,
        processingStatus: "processing",
        leaseUntil: { $gt: now },
      }),
      Conversation.countDocuments({ userId: job.userId, processingLeaseUntil: { $gt: now } }),
      User.findById(job.userId).select("+activeChatOperations +activeUploadOperations").lean(),
    ]);
    if (activeDocuments || activeConversations || userActivity?.activeChatOperations || userActivity?.activeUploadOperations) {
      await AccountDeletion.updateOne(
        { _id: job._id, leaseOwner: job.leaseOwner },
        {
          $set: { status: "queued", nextAttemptAt: new Date(Date.now() + 5000), lastError: "Waiting for active chat or document processing to stop" },
          $unset: { leaseUntil: "", leaseOwner: "" },
          $inc: { attempts: -1 },
        },
      );
      return { waiting: true };
    }

    await Document.updateMany({ userId: job.userId }, { $unset: { leaseUntil: "", leaseOwner: "" } });
    await Conversation.updateMany(
      { userId: job.userId },
      { $unset: { processingLeaseUntil: "", processingOwner: "" } },
    );

    if (vectorStore.isConfigured()) {
      const remote = await vectorStore.deleteUserNamespace(job.userId);
      if (!remote.deleted) throw new Error(`Remote vector deletion failed: ${remote.reason || "unknown error"}`);
    }

    const documents = await Document.find({ userId: job.userId }).select("_id +rawUploadId").lean();
    for (const document of documents) {
      const raw = await documentQueueService.deleteUpload(document.rawUploadId);
      if (!raw.deleted) throw new Error(`Original upload deletion failed for document ${document._id}`);
    }

    if (process.env.MONGODB_TRANSACTIONS === "true") {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(() => deleteLocalRecords(job, session));
      } finally {
        await session.endSession();
      }
    } else {
      await deleteLocalRecords(job);
    }
    logger.info("Account deletion completed", { userId: job.userId.toString() });
    return { deleted: true, userId: job.userId.toString() };
  } catch (error) {
    const exhausted = Number(job.attempts || 0) >= maxAttempts();
    const delay = Math.min(60 * 60 * 1000, 15000 * (2 ** Math.max(0, Number(job.attempts || 1) - 1)));
    await AccountDeletion.updateOne(
      { _id: job._id, leaseOwner: job.leaseOwner },
      {
        $set: {
          status: exhausted ? "failed" : "queued",
          nextAttemptAt: exhausted ? null : new Date(Date.now() + delay),
          lastError: String(error.message || "Account deletion failed").slice(0, 500),
        },
        $unset: { leaseUntil: "", leaseOwner: "" },
      },
    );
    logger.warn("Account deletion attempt failed", { userId: job.userId.toString(), reason: error.message, exhausted });
    return { deleted: false, retryScheduled: !exhausted, reason: error.message };
  } finally {
    clearInterval(heartbeat);
  }
}

async function startWorker() {
  const pollMs = Math.max(500, Number(process.env.ACCOUNT_DELETION_POLL_MS || 2000));
  logger.info("Account deletion worker started");
  while (true) {
    const result = await processNext();
    if (result.skipped || result.waiting) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

export const accountDeletionService = { enqueue, processNext, startWorker, _test: { claim } };

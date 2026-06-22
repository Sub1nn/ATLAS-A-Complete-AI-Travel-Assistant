import crypto from "crypto";
import { AccountDeletion } from "../models/AccountDeletion.js";
import { Document } from "../models/Document.js";
import { DocumentDeletion } from "../models/DocumentDeletion.js";
import { WorkerHeartbeat } from "../models/WorkerHeartbeat.js";

const heartbeatMs = () => Math.max(5000, Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS || 10000));
const staleMs = () => Math.max(heartbeatMs() * 2, Number(process.env.WORKER_HEARTBEAT_STALE_MS || 45000));

async function beat(workerName, instanceId, startedAt) {
  const now = new Date();
  await WorkerHeartbeat.updateOne(
    { workerName, instanceId },
    { $set: { lastSeenAt: now, startedAt, expiresAt: new Date(now.getTime() + staleMs() * 4) } },
    { upsert: true },
  );
}

async function start(workerName) {
  const instanceId = process.env.HOSTNAME || crypto.randomUUID();
  const startedAt = new Date();
  await beat(workerName, instanceId, startedAt);
  const timer = setInterval(() => beat(workerName, instanceId, startedAt).catch(() => {}), heartbeatMs());
  timer.unref();
  return { workerName, instanceId, stop: () => clearInterval(timer) };
}

function requiredWorkers() {
  return String(process.env.REQUIRED_WORKERS || "documents,privacy,retention")
    .split(",").map((item) => item.trim()).filter(Boolean);
}

async function snapshot() {
  const cutoff = new Date(Date.now() - staleMs());
  const heartbeats = await WorkerHeartbeat.find({ lastSeenAt: { $gte: cutoff } }).sort({ lastSeenAt: -1 }).lean();
  const active = new Set(heartbeats.map((item) => item.workerName));
  const required = requiredWorkers();
  const missing = required.filter((name) => !active.has(name));
  const now = new Date();
  const [oldestDocument, oldestDocumentDeletion, oldestAccountDeletion, documentDeadLetters, accountDeadLetters] = await Promise.all([
    Document.findOne({ processingStatus: { $in: ["queued", "processing"] }, deletionPending: { $ne: true } }).sort({ createdAt: 1 }).select("createdAt").lean(),
    DocumentDeletion.findOne({ status: { $in: ["queued", "failed", "processing"] } }).sort({ createdAt: 1 }).select("createdAt").lean(),
    AccountDeletion.findOne({ status: { $in: ["queued", "failed", "processing"] } }).sort({ createdAt: 1 }).select("createdAt").lean(),
    DocumentDeletion.countDocuments({ status: "dead_letter" }),
    AccountDeletion.countDocuments({ status: "dead_letter" }),
  ]);
  const age = (item) => item?.createdAt ? Math.max(0, Math.round((now - item.createdAt) / 1000)) : 0;
  const queues = {
    documentOldestSeconds: age(oldestDocument),
    documentDeletionOldestSeconds: age(oldestDocumentDeletion),
    accountDeletionOldestSeconds: age(oldestAccountDeletion),
    documentDeletionDeadLetters: documentDeadLetters,
    accountDeletionDeadLetters: accountDeadLetters,
  };
  const maxQueueAge = Math.max(30, Number(process.env.WORKER_MAX_QUEUE_AGE_SECONDS || 300));
  const delayed = Object.entries(queues)
    .filter(([key, value]) => key.endsWith("OldestSeconds") && value > maxQueueAge)
    .map(([key]) => key);
  return {
    healthy: missing.length === 0 && delayed.length === 0 && documentDeadLetters === 0 && accountDeadLetters === 0,
    missing,
    delayed,
    active: heartbeats.map(({ workerName, instanceId, lastSeenAt }) => ({ workerName, instanceId, lastSeenAt })),
    queues,
  };
}

async function isHealthy(workerName) {
  return Boolean(await WorkerHeartbeat.exists({ workerName, lastSeenAt: { $gte: new Date(Date.now() - staleMs()) } }));
}

export const workerHealthService = { start, snapshot, isHealthy, _test: { requiredWorkers } };

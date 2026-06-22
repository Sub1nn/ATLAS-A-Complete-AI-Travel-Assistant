import crypto from "crypto";
import mongoose from "mongoose";
import { OperationLease } from "../models/OperationLease.js";
import { User } from "../models/User.js";

const durationMs = () => Math.max(60000, Number(process.env.OPERATION_LEASE_MS || 5 * 60 * 1000));

async function acquire(userId, type) {
  const owner = crypto.randomUUID();
  const create = async (session = null) => {
    const options = session ? { session } : undefined;
    const active = await User.updateOne(
      { _id: userId, deletionPending: { $ne: true } },
      { $set: { operationLeaseFenceAt: new Date() } },
      options,
    );
    if (!active.matchedCount) {
      const error = new Error("Account deletion is in progress");
      error.status = 423;
      error.code = "ACCOUNT_DELETION_PENDING";
      throw error;
    }
    const lease = new OperationLease({ userId, owner, type, expiresAt: new Date(Date.now() + durationMs()) });
    await lease.save(options);
  };

  if (process.env.MONGODB_TRANSACTIONS === "true") {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() => create(session));
    } finally {
      await session.endSession();
    }
  } else {
    await create();
  }
  return { owner, userId, type };
}

function heartbeat(lease) {
  const timer = setInterval(() => {
    OperationLease.updateOne(
      { owner: lease.owner, userId: lease.userId },
      { $set: { expiresAt: new Date(Date.now() + durationMs()) } },
    ).catch(() => {});
  }, Math.max(15000, Math.floor(durationMs() / 3)));
  timer.unref();
  return timer;
}

async function release(lease, timer = null) {
  if (timer) clearInterval(timer);
  if (lease?.owner) await OperationLease.deleteOne({ owner: lease.owner, userId: lease.userId }).catch(() => {});
}

export const operationLeaseService = { acquire, heartbeat, release };

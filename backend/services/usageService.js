import { DailyUsage } from "../models/DailyUsage.js";

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function expiry(date = new Date()) {
  return new Date(date.getTime() + 35 * 24 * 60 * 60 * 1000);
}

async function reserveChat(userId) {
  const day = dayKey();
  const limit = Math.max(1, Number(process.env.DAILY_CHAT_REQUEST_LIMIT || 50));
  const updated = await DailyUsage.findOneAndUpdate(
    { userId, day, chatRequests: { $lt: limit } },
    { $inc: { chatRequests: 1 }, $setOnInsert: { expiresAt: expiry() } },
    { new: true },
  );
  if (updated) return { allowed: true, used: updated.chatRequests, limit };

  try {
    const created = await DailyUsage.create({ userId, day, chatRequests: 1, expiresAt: expiry() });
    return { allowed: true, used: created.chatRequests, limit };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const retried = await DailyUsage.findOneAndUpdate(
      { userId, day, chatRequests: { $lt: limit } },
      { $inc: { chatRequests: 1 } },
      { new: true },
    );
    if (retried) return { allowed: true, used: retried.chatRequests, limit };
    const current = await DailyUsage.findOne({ userId, day }).lean();
    return { allowed: false, used: current?.chatRequests || limit, limit };
  }
}

async function ensureDailyUsage(userId, day) {
  try {
    await DailyUsage.updateOne(
      { userId, day },
      { $setOnInsert: { chatRequests: 0, toolCalls: 0, providerCalls: 0, llmCalls: 0, expiresAt: expiry() } },
      { upsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  await DailyUsage.updateOne({ userId, day, providerCalls: { $exists: false } }, { $set: { providerCalls: 0 } });
}

async function reserveProviderUsage(userId, { toolCalls = 0, externalCalls = 0, llmCalls = 0 } = {}) {
  const day = dayKey();
  const requestedProviders = Math.max(0, Number(externalCalls || toolCalls || 0));
  const requestedLlm = Math.max(0, Number(llmCalls || 0));
  const providerLimit = Math.max(1, Number(process.env.DAILY_PROVIDER_CALL_LIMIT || process.env.DAILY_TOOL_CALL_LIMIT || 120));
  const llmLimit = Math.max(1, Number(process.env.DAILY_LLM_CALL_LIMIT || 60));
  await ensureDailyUsage(userId, day);
  const usage = await DailyUsage.findOneAndUpdate(
    {
      userId,
      day,
      providerCalls: { $lte: providerLimit - requestedProviders },
      llmCalls: { $lte: llmLimit - requestedLlm },
    },
    { $inc: { providerCalls: requestedProviders, llmCalls: requestedLlm } },
    { new: true },
  );
  return usage
    ? { allowed: true, providerCalls: usage.providerCalls, llmCalls: usage.llmCalls, providerLimit, llmLimit }
    : { allowed: false, providerLimit, llmLimit };
}

async function reserveExternalCall(userId, calls = 1) {
  return reserveProviderUsage(userId, { externalCalls: Math.max(1, Number(calls || 1)) });
}

export const usageService = { reserveChat, reserveProviderUsage, reserveExternalCall, _test: { dayKey, expiry } };

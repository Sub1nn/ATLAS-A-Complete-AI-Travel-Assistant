import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "authenticated-load-test-secret-longer-than-thirty-two-characters";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/atlas_authenticated_load";
process.env.PRIVACY_POLICY_VERSION ||= "2026-06-22";
process.env.TERMS_VERSION ||= "2026-06-22";
process.env.PINECONE_ENABLED = "false";
process.env.ATLAS_LLM_PLANNER_ENABLED = "false";
process.env.DAILY_CHAT_REQUEST_LIMIT = "100";
process.env.CHAT_RATE_LIMIT_MAX_REQUESTS = "100";

await mongoose.connect(process.env.MONGODB_URI);
const [{ default: app }, { User }] = await Promise.all([import("../app.js"), import("../models/User.js")]);
const email = `load-${Date.now()}@example.test`;
const password = "AuthenticatedLoadPassword123";
const latencies = [];
let failures = 0;

async function measured(operation) {
  const started = performance.now();
  try {
    const response = await operation();
    if (response.status < 200 || response.status >= 300) failures += 1;
  } catch {
    failures += 1;
  } finally {
    latencies.push(performance.now() - started);
  }
}

try {
  await User.create({
    name: "Authenticated Load User",
    email,
    passwordHash: await bcrypt.hash(password, 4),
    emailVerified: true,
    emailVerifiedAt: new Date(),
    legalAcceptance: { privacyVersion: process.env.PRIVACY_POLICY_VERSION, termsVersion: process.env.TERMS_VERSION, acceptedAt: new Date() },
  });
  const login = await request(app).post("/api/auth/login").send({ email, password });
  assert.equal(login.status, 200);
  const authorization = `Bearer ${login.body.token}`;

  const operations = [
    ...Array.from({ length: 20 }, () => () => request(app).post("/api/chat").set("Authorization", authorization).send({ clientRequestId: crypto.randomUUID(), message: "Who are you?", documentIds: [] })),
    ...Array.from({ length: 115 }, () => () => request(app).get("/api/auth/me").set("Authorization", authorization)),
    ...Array.from({ length: 115 }, () => () => request(app).get("/api/conversations").set("Authorization", authorization)),
  ];
  let cursor = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: 20 }, async () => {
    while (cursor < operations.length) {
      const index = cursor;
      cursor += 1;
      await measured(operations[index]);
    }
  }));
  latencies.sort((a, b) => a - b);
  const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;
  const seconds = (performance.now() - started) / 1000;
  const report = {
    scenario: "authenticated auth/history/chat with MongoDB",
    requests: operations.length,
    concurrency: 20,
    failures,
    requestsPerSecond: Number((operations.length / seconds).toFixed(2)),
    p50Ms: Number(percentile(0.5).toFixed(2)),
    p95Ms: Number(percentile(0.95).toFixed(2)),
    p99Ms: Number(percentile(0.99).toFixed(2)),
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures) process.exitCode = 1;
} finally {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

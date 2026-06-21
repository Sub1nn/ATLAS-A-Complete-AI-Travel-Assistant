import test from "node:test";
import assert from "node:assert/strict";
import { verifyResponse } from "../services/responseVerifier.js";
import { cacheKey, getOrSetCache } from "../services/cacheService.js";
import { hasAllowedSignature } from "../controllers/documentController.js";
import { chatRateLimiter } from "../config/rateLimiter.js";
import mongoose from "mongoose";
import { Conversation, normalizeConversationMemory } from "../models/Conversation.js";
import { User } from "../models/User.js";
import { documentService } from "../services/documentService.js";
import { contextService } from "../services/contextService.js";

process.env.NODE_ENV = "test";

test("response verifier adds caution for unsupported prices and availability", () => {
  const { answer, verification } = verifyResponse({
    answer: "Hotel Example is available for €120 per night and is completely safe.",
    toolResults: [],
    documentMatches: [],
  });

  assert.equal(verification.modified, true);
  assert.match(answer, /Verification note/);
  assert.match(answer, /prices/i);
  assert.doesNotMatch(answer, /completely safe/i);
});

test("cache service stores and retrieves with development memory fallback", async () => {
  const key = cacheKey("test", { b: 2, a: 1 });
  let calls = 0;
  const first = await getOrSetCache(key, 30, async () => {
    calls += 1;
    return { ok: true };
  });
  const second = await getOrSetCache(key, 30, async () => {
    calls += 1;
    return { ok: false };
  });

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.value.ok, true);
  assert.equal(calls, 1);
});

test("document signature validation accepts PDF and rejects mismatched DOCX", () => {
  assert.equal(hasAllowedSignature({ originalname: "file.pdf", buffer: Buffer.from("%PDF-test") }), true);
  assert.equal(hasAllowedSignature({ originalname: "file.docx", buffer: Buffer.from("not-a-zip") }), false);
});

test("chat rate limiter is configured as middleware", () => {
  assert.equal(typeof chatRateLimiter, "function");
});

test("security and conversation memory fields are persisted by the schemas", () => {
  assert.ok(User.schema.path("tokenVersion"));
  assert.ok(Conversation.schema.path("memory.locationScope"));
  assert.ok(Conversation.schema.path("memory.pendingActivitySearch.activity"));
  assert.ok(Conversation.schema.path("memory.route.origin"));
});

test("document chunks overlap without exceeding their maximum size", () => {
  const chunks = documentService.chunkText("travel planning context ".repeat(200), 240, 40);
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 240));
  const tail = chunks[0].text.slice(-25).trim();
  assert.ok(chunks[1].text.includes(tail.split(" ").at(-1)));
});

test("destination memory without optional route fields validates", async () => {
  const resolved = contextService.resolveContext(
    "I am thinking to travel to Tehran this weekend as a tourist",
    {},
    [],
  );
  const normalized = normalizeConversationMemory({
    ...resolved.memory,
    route: undefined,
    pendingActivitySearch: undefined,
  });
  const conversation = new Conversation({
    userId: new mongoose.Types.ObjectId(),
    title: "Tehran trip",
    memory: normalized,
  });

  await conversation.validate();
  assert.equal(conversation.memory.destination.toLowerCase(), "tehran");
  assert.equal(conversation.memory.route, undefined);
  assert.equal(conversation.memory.pendingActivitySearch, undefined);
});

import { namespaceFor, vectorStore } from "../services/vectorStore.js";

test("Pinecone namespace is isolated per user and metadata is flat", () => {
  const namespace = namespaceFor("64ffabc123");
  assert.equal(namespace, "atlas-user-64ffabc123");

  const metadata = vectorStore._test.sanitizeMetadata({
    userId: "u1",
    documentId: "d1",
    chunkIndex: 2,
    nested: { unsafe: true },
    empty: null,
    tags: ["a", "b", 12],
  });

  assert.deepEqual(metadata, {
    userId: "u1",
    documentId: "d1",
    chunkIndex: 2,
    tags: ["a", "b"],
  });
});

test("Pinecone can be disabled without breaking local document fallback", async () => {
  const previous = process.env.PINECONE_ENABLED;
  process.env.PINECONE_ENABLED = "false";
  assert.equal(vectorStore.isConfigured(), false);
  assert.match(vectorStore.configurationIssue(), /disabled/i);
  process.env.PINECONE_ENABLED = previous;
});

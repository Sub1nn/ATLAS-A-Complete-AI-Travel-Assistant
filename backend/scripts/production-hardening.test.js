import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { verifyResponse } from "../services/responseVerifier.js";
import { cacheKey, getOrSetCache } from "../services/cacheService.js";
import { hasAllowedSignature } from "../controllers/documentController.js";
import { chatRateLimiter } from "../config/rateLimiter.js";
import mongoose from "mongoose";
import { Conversation, normalizeConversationMemory } from "../models/Conversation.js";
import { isDocumentFocusedRequest } from "../controllers/chatController.js";
import { User } from "../models/User.js";
import { documentService } from "../services/documentService.js";
import { contextService } from "../services/contextService.js";
import { toolService } from "../services/toolService.js";
import { Session } from "../models/Session.js";
import { ChatRequest } from "../models/ChatRequest.js";
import { DailyUsage } from "../models/DailyUsage.js";
import { Document } from "../models/Document.js";
import { AccountDeletion } from "../models/AccountDeletion.js";
import { StorageUsage } from "../models/StorageUsage.js";
import { OperationLease } from "../models/OperationLease.js";
import { DocumentDeletion } from "../models/DocumentDeletion.js";
import { WorkerHeartbeat } from "../models/WorkerHeartbeat.js";
import { GlobalUsage } from "../models/GlobalUsage.js";
import { sessionService } from "../services/sessionService.js";
import { emailService } from "../services/emailService.js";
import { usageService } from "../services/usageService.js";
import { authSignupSchema, chatRequestSchema, validate } from "../utils/validation.js";

process.env.NODE_ENV = "test";
const execFileAsync = promisify(execFile);

test("document extraction runs in a bounded child process", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-extractor-test-"));
  const source = path.join(directory, "sample.txt");
  await fs.writeFile(source, "Safe travel notes for Helsinki");
  try {
    const { stdout } = await execFileAsync(process.execPath, [new URL("./extract-document-child.js", import.meta.url).pathname, source, "text/plain", "sample.txt"], {
      env: { ...process.env, MAX_DOCUMENT_TEXT_CHARS: "1000" },
    });
    assert.equal(stdout, "Safe travel notes for Helsinki");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("response verifier adds caution for unsupported prices and availability", () => {
  const { answer, verification } = verifyResponse({
    answer: "Hotel Example is available for €120 per night and is completely safe.",
    toolResults: [],
    documentMatches: [],
  });

  assert.equal(verification.modified, true);
  assert.match(answer, /Verification note/);
  assert.match(answer, /prices/i);
  assert.doesNotMatch(answer, /€120/);
  assert.doesNotMatch(answer, /is available/i);
  assert.doesNotMatch(answer, /completely safe/i);
});

test("attached documents do not hijack ordinary short travel questions", () => {
  const documentIds = [new mongoose.Types.ObjectId().toString()];
  assert.equal(isDocumentFocusedRequest("What is the weather in Helsinki?", documentIds), false);
  assert.equal(isDocumentFocusedRequest("Find hotels in Tokyo", documentIds), false);
  assert.equal(isDocumentFocusedRequest("Summarize the attached PDF", documentIds), true);
  assert.equal(isDocumentFocusedRequest("What does this document say?", documentIds), true);
});

test("news safety classification has no numerical risk score or country baseline", () => {
  const coverage = toolService._test.newsCoverageFromArticles([
    { title: "Airport closure after major storm", description: "Travel disruption continues", publishedAt: "2026-06-22T08:00:00Z" },
  ]);
  assert.equal(coverage.news_attention_level, "high");
  assert.equal("score" in coverage, false);
  assert.match(coverage.interpretation, /not a destination risk score/i);
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

test("chat requests require a UUID idempotency key", () => {
  const valid = validate(chatRequestSchema, { clientRequestId: crypto.randomUUID(), message: "hello", documentIds: [] });
  const invalid = validate(chatRequestSchema, { message: "hello", documentIds: [] });
  assert.equal(valid.error, null);
  assert.match(invalid.error, /request ID/i);
});

test("signup requires explicit privacy acceptance", () => {
  const base = { name: "Test User", email: "test@example.com", password: "Password1234" };
  assert.match(validate(authSignupSchema, base).error, /privacy policy/i);
  assert.equal(validate(authSignupSchema, { ...base, privacyAccepted: true }).error, null);
});

test("refresh sessions use HttpOnly cookies and email actions use URL fragments", () => {
  const options = sessionService._test.cookieOptions();
  assert.equal(options.httpOnly, true);
  assert.equal(options.path, "/api/auth");
  assert.equal(sessionService._test.parseCookies("one=1; atlas_refresh=secret").atlas_refresh, "secret");
  assert.equal(sessionService._test.safeEqual("matching", "matching"), true);
  assert.equal(sessionService._test.safeEqual("matching", "different"), false);
  assert.match(emailService.verificationLink("a".repeat(32)), /verify-email#token=/);
  assert.match(emailService.resetLink("b".repeat(32)), /reset-password#token=/);
});

test("Routes API v2 responses are converted to compact route guidance", () => {
  const route = toolService._test.compactRouteLeg({
    description: "Fast route",
    distanceMeters: 12500,
    duration: "3900s",
    legs: [{ steps: [{ distanceMeters: 800, staticDuration: "600s", travelMode: "WALK", navigationInstruction: { instructions: "Walk north" } }] }],
  }, "Helsinki", "Porvoo");
  assert.equal(route.summary, "Fast route");
  assert.equal(route.distance, "13 km");
  assert.equal(route.duration, "1 hr 5 min");
  assert.equal(route.steps[0].instruction, "Walk north");
});

test("tool execution stops immediately for an aborted request", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    toolService.executeTool("route_and_transport_planner", { origin: "A", destination: "B" }, { signal: controller.signal }),
    (error) => error.code === "ERR_CANCELED",
  );
});

test("privacy, idempotency, usage and processing fields are indexed", () => {
  assert.ok(User.schema.path("legalAcceptance.privacyVersion"));
  assert.ok(Session.schema.path("refreshTokenHash"));
  assert.ok(ChatRequest.schema.path("clientRequestId"));
  assert.ok(DailyUsage.schema.path("chatRequests"));
  assert.ok(Document.schema.path("processingStatus"));
  assert.ok(Document.schema.path("leaseOwner"));
  assert.ok(User.schema.path("deletionPending"));
  assert.ok(AccountDeletion.schema.path("leaseOwner"));
  assert.ok(StorageUsage.schema.path("documentCount"));
  assert.ok(OperationLease.schema.path("expiresAt"));
  assert.ok(DocumentDeletion.schema.path("leaseOwner"));
  assert.ok(WorkerHeartbeat.schema.path("lastSeenAt"));
  assert.ok(GlobalUsage.schema.path("providerCalls"));
  assert.equal(usageService._test.dayKey(new Date("2026-06-22T12:00:00Z")), "2026-06-22");
});

test("provider circuits ignore permanent client errors and local budget rejection", () => {
  assert.equal(toolService._test.shouldRecordProviderFailure({ status: 400 }), false);
  assert.equal(toolService._test.shouldRecordProviderFailure({ status: 404 }), false);
  assert.equal(toolService._test.shouldRecordProviderFailure({ status: 429 }), true);
  assert.equal(toolService._test.shouldRecordProviderFailure({ status: 503 }), true);
  assert.equal(toolService._test.shouldRecordProviderFailure({ code: "PROVIDER_BUDGET_EXCEEDED", status: 429 }), false);
  assert.equal(toolService._test.shouldRecordProviderFailure(new Error("network failure")), true);
});

test("provider circuit opens after repeated failures and resets after success", () => {
  const previous = process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD;
  process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD = "2";
  toolService._test.recordProviderFailure("test-provider");
  toolService._test.recordProviderFailure("test-provider");
  assert.throws(() => toolService._test.assertCircuitClosed("test-provider"), /circuit/i);
  toolService._test.recordProviderSuccess("test-provider");
  assert.doesNotThrow(() => toolService._test.assertCircuitClosed("test-provider"));
  if (previous === undefined) delete process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD;
  else process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD = previous;
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

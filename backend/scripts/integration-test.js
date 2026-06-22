import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import crypto from "node:crypto";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "integration-test-secret-that-is-longer-than-thirty-two-characters";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/atlas_integration";
process.env.PRIVACY_POLICY_VERSION ||= "2026-06-22";
process.env.TERMS_VERSION ||= "2026-06-22";
process.env.PINECONE_ENABLED = "false";

await mongoose.connect(process.env.MONGODB_URI);
const [{ default: app }, { User }] = await Promise.all([
  import("../app.js"),
  import("../models/User.js"),
]);
const [{ Session }, { ChatRequest }, { DailyUsage }, { GlobalUsage }, { Document }, { Conversation }, { Message }, { AccountDeletion }, { OperationLease }, { DocumentDeletion }, { StorageUsage }, { usageService }, { documentQueueService }, { accountDeletionService }, { documentDeletionService }, { storageUsageService }, { chatController }] = await Promise.all([
  import("../models/Session.js"),
  import("../models/ChatRequest.js"),
  import("../models/DailyUsage.js"),
  import("../models/GlobalUsage.js"),
  import("../models/Document.js"),
  import("../models/Conversation.js"),
  import("../models/Message.js"),
  import("../models/AccountDeletion.js"),
  import("../models/OperationLease.js"),
  import("../models/DocumentDeletion.js"),
  import("../models/StorageUsage.js"),
  import("../services/usageService.js"),
  import("../services/documentQueueService.js"),
  import("../services/accountDeletionService.js"),
  import("../services/documentDeletionService.js"),
  import("../services/storageUsageService.js"),
  import("../controllers/chatController.js"),
]);

const email = `integration-${Date.now()}@example.test`;
const password = "IntegrationPassword123";

try {
  await Promise.all([ChatRequest.syncIndexes(), StorageUsage.syncIndexes(), AccountDeletion.syncIndexes(), OperationLease.syncIndexes(), DocumentDeletion.syncIndexes(), GlobalUsage.syncIndexes()]);
  await User.create({
    name: "Integration User",
    email,
    passwordHash: await bcrypt.hash(password, 4),
    emailVerified: true,
    emailVerifiedAt: new Date(),
    legalAcceptance: { privacyVersion: process.env.PRIVACY_POLICY_VERSION, termsVersion: process.env.TERMS_VERSION, acceptedAt: new Date() },
  });

  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
  assert.match(login.headers["set-cookie"]?.join(";") || "", /atlas_refresh=.*HttpOnly/i);

  const initialCookie = login.headers["set-cookie"].map((value) => value.split(";", 1)[0]).join("; ");
  const concurrentRefreshes = await Promise.all([
    request(app).post("/api/auth/refresh").set("Cookie", initialCookie).set("X-CSRF-Token", login.body.csrfToken).send({}),
    request(app).post("/api/auth/refresh").set("Cookie", initialCookie).set("X-CSRF-Token", login.body.csrfToken).send({}),
  ]);
  assert.deepEqual(concurrentRefreshes.map(({ status }) => status).sort(), [200, 409]);
  const refresh = concurrentRefreshes.find(({ status }) => status === 200);
  assert.ok(refresh.body.token);
  assert.equal((await User.findOne({ email }).lean()).tokenVersion, 0);
  assert.equal(await Session.countDocuments({ userId: refresh.body.user.id, revokedAt: null }), 1);

  process.env.DAILY_CHAT_REQUEST_LIMIT = "20";
  const reservations = await Promise.all(Array.from({ length: 10 }, () => usageService.reserveChat(refresh.body.user.id)));
  assert.equal(reservations.filter(({ allowed }) => allowed).length, 10);
  assert.equal((await DailyUsage.findOne({ userId: refresh.body.user.id }).lean()).chatRequests, 10);

  process.env.GLOBAL_DAILY_PROVIDER_CALL_LIMIT = "4";
  const globalReservations = await Promise.all(Array.from({ length: 8 }, () => usageService.reserveExternalCall(refresh.body.user.id)));
  assert.equal(globalReservations.filter(({ allowed }) => allowed).length, 4);
  assert.equal((await GlobalUsage.findOne({}).lean()).providerCalls, 4);
  process.env.GLOBAL_DAILY_PROVIDER_CALL_LIMIT = "10000";

  const invalidRequestId = crypto.randomUUID();
  const invalidAttachment = await request(app)
    .post("/api/chat")
    .set("Authorization", `Bearer ${refresh.body.token}`)
    .send({ clientRequestId: invalidRequestId, message: "Summarize this", documentIds: [new mongoose.Types.ObjectId().toString()] });
  assert.equal(invalidAttachment.status, 400);
  assert.equal((await ChatRequest.findOne({ clientRequestId: invalidRequestId }).lean()).status, "failed");

  const concurrentRequestId = crypto.randomUUID();
  const chatPayload = { clientRequestId: concurrentRequestId, message: "Who are you?", documentIds: [] };
  const duplicateChats = await Promise.all([
    request(app).post("/api/chat").set("Authorization", `Bearer ${refresh.body.token}`).send(chatPayload),
    request(app).post("/api/chat").set("Authorization", `Bearer ${refresh.body.token}`).send(chatPayload),
  ]);
  assert.ok(duplicateChats.some(({ status }) => status === 200));
  assert.ok(duplicateChats.every(({ status }) => [200, 409].includes(status)));
  const completedChat = await ChatRequest.findOne({ clientRequestId: concurrentRequestId }).lean();
  assert.equal(completedChat.status, "completed");
  assert.equal(await Message.countDocuments({ conversationId: completedChat.response.conversationId }), 2);
  await Conversation.updateOne(
    { _id: completedChat.response.conversationId },
    { $set: { processingOwner: "other-tab", processingLeaseUntil: new Date(Date.now() + 60000) } },
  );
  const lockedRequestId = crypto.randomUUID();
  const lockedConversation = await request(app)
    .post("/api/chat")
    .set("Authorization", `Bearer ${refresh.body.token}`)
    .send({ clientRequestId: lockedRequestId, conversationId: completedChat.response.conversationId, message: "Tell me more", documentIds: [] });
  assert.equal(lockedConversation.status, 409);
  assert.equal((await ChatRequest.findOne({ clientRequestId: lockedRequestId }).lean()).status, "failed");
  await Conversation.updateOne({ _id: completedChat.response.conversationId }, { $unset: { processingOwner: "", processingLeaseUntil: "" } });
  assert.equal(await OperationLease.countDocuments({ userId: refresh.body.user.id }), 0);

  const fencedConversation = await Conversation.create({
    userId: refresh.body.user.id,
    title: "Newer conversation state",
    processingOwner: "newer-owner",
    processingLeaseUntil: new Date(Date.now() + 60000),
  });
  const staleRequest = await ChatRequest.create({
    userId: refresh.body.user.id,
    clientRequestId: crypto.randomUUID(),
    status: "processing",
    processingOwner: "stale-owner",
    processingLeaseUntil: new Date(Date.now() + 60000),
    expiresAt: new Date(Date.now() + 60000),
  });
  fencedConversation.title = "Stale overwrite";
  await assert.rejects(
    chatController._test.persistConversationTurn(
      fencedConversation,
      [{ userId: refresh.body.user.id, conversationId: fencedConversation._id, role: "user", content: "stale" }],
      staleRequest._id,
      "stale-owner",
      { conversationId: fencedConversation._id.toString(), answer: "stale" },
    ),
    /lease ownership was lost/i,
  );
  assert.equal((await Conversation.findById(fencedConversation._id).lean()).title, "Newer conversation state");
  assert.equal(await Message.countDocuments({ conversationId: fencedConversation._id }), 0);
  await Conversation.updateOne({ _id: fencedConversation._id }, { $unset: { processingOwner: "", processingLeaseUntil: "" } });

  const leaseDocument = await Document.create({
    userId: refresh.body.user.id,
    originalName: "lease-test.txt",
    mimeType: "text/plain",
    size: 32,
    processingStatus: "processing",
    leaseUntil: new Date(Date.now() - 1000),
  });
  const reclaimed = await documentQueueService._test.claimDocument(leaseDocument._id);
  assert.equal(reclaimed?.processingStatus, "processing");
  assert.equal(reclaimed?.attempts, 1);
  await assert.rejects(
    documentQueueService._test.assertDocumentOwnership(leaseDocument._id, "wrong-owner"),
    (error) => error.code === "DOCUMENT_LEASE_LOST",
  );
  await Document.deleteOne({ _id: leaseDocument._id });

  const deletionRaceDocument = await Document.create({
    userId: refresh.body.user.id,
    originalName: "document-deletion-race.txt",
    mimeType: "text/plain",
    size: 0,
    processingStatus: "processing",
    leaseOwner: "active-document-worker",
    leaseUntil: new Date(Date.now() + 60000),
  });
  await documentDeletionService.requestDeletion(deletionRaceDocument._id, refresh.body.user.id);
  assert.equal((await documentDeletionService.processNext()).waiting, true);
  assert.equal(await Document.countDocuments({ _id: deletionRaceDocument._id }), 1);
  await Document.updateOne({ _id: deletionRaceDocument._id }, { $set: { leaseUntil: new Date(Date.now() - 1000) } });
  await DocumentDeletion.updateOne({ documentId: deletionRaceDocument._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
  assert.equal((await documentDeletionService.processNext()).deleted, true);
  assert.equal(await Document.countDocuments({ _id: deletionRaceDocument._id }), 0);

  const storageReservations = await Promise.all(
    Array.from({ length: 5 }, () => storageUsageService.reserve(refresh.body.user.id, 1, { maxDocuments: 3, maxBytes: 100 })),
  );
  assert.equal(storageReservations.filter(({ allowed }) => allowed).length, 3);
  assert.equal((await StorageUsage.findOne({ userId: refresh.body.user.id }).lean()).documentCount, 3);

  await ChatRequest.create({
    userId: refresh.body.user.id,
    clientRequestId: `integration-${Date.now()}`,
    status: "completed",
    expiresAt: new Date(Date.now() + 60000),
  });

  const dataExport = await agent.get("/api/auth/data-export").set("Authorization", `Bearer ${refresh.body.token}`);
  assert.equal(dataExport.status, 200);
  assert.match(dataExport.headers["content-disposition"] || "", /atlas-data-export/);

  const activeDeletionDocument = await Document.create({
    userId: refresh.body.user.id,
    originalName: "deletion-race.txt",
    mimeType: "text/plain",
    size: 32,
    processingStatus: "processing",
    leaseOwner: "active-worker",
    leaseUntil: new Date(Date.now() + 60000),
  });
  await OperationLease.create({
    userId: refresh.body.user.id,
    owner: crypto.randomUUID(),
    type: "upload",
    expiresAt: new Date(Date.now() + 60000),
  });
  const deletion = await agent.delete("/api/auth/account").set("Authorization", `Bearer ${refresh.body.token}`).send({ password });
  assert.equal(deletion.status, 202);
  assert.match(deletion.body.trackingToken, /^[a-f0-9]{64}$/);
  assert.equal((await User.findOne({ email }).lean()).deletionPending, true);
  assert.equal((await accountDeletionService.processNext()).waiting, true);
  assert.equal(await User.countDocuments({ email }), 1);
  await Document.updateOne({ _id: activeDeletionDocument._id }, { $set: { leaseUntil: new Date(Date.now() - 1000) } });
  await OperationLease.updateMany({ userId: refresh.body.user.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await AccountDeletion.updateOne({ userId: refresh.body.user.id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
  assert.equal((await accountDeletionService.processNext()).deleted, true);
  assert.equal(await User.countDocuments({ email }), 0);
  assert.equal(await Session.countDocuments({ userId: refresh.body.user.id }), 0);
  assert.equal(await ChatRequest.countDocuments({ userId: refresh.body.user.id }), 0);
  assert.equal(await DailyUsage.countDocuments({ userId: refresh.body.user.id }), 0);
  assert.equal(await AccountDeletion.countDocuments({ userId: refresh.body.user.id }), 0);
  assert.equal(await AccountDeletion.countDocuments({ status: "completed" }), 1);
  const deletionStatus = await request(app).get(`/api/auth/account-deletion-status?token=${deletion.body.trackingToken}`);
  assert.equal(deletionStatus.status, 200);
  assert.equal(deletionStatus.body.status, "completed");
  assert.equal(await StorageUsage.countDocuments({ userId: refresh.body.user.id }), 0);
  assert.equal(await Conversation.countDocuments({ userId: refresh.body.user.id }), 0);
  console.log("ATLAS authenticated integration flow passed");
} finally {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

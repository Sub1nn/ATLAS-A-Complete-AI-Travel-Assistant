import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { requireCurrentPolicies, requireVerifiedEmail } from "../middleware/auth.js";
import { toolService } from "../services/toolService.js";

test("readiness health returns a failure status without MongoDB", async () => {
  const response = await request(app).get("/health/ready");
  assert.equal(response.status, 503);
  assert.equal(response.body.status, "degraded");
  assert.equal(response.body.database, "unavailable");
});

test("liveness health does not depend on MongoDB", async () => {
  const response = await request(app).get("/health/live");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "alive");
});

test("security headers and hidden Express signature are enabled", async () => {
  const response = await request(app).get("/health/live");
  assert.equal(response.headers["x-powered-by"], undefined);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
  assert.match(response.headers["x-request-id"], /^[a-f0-9-]{36}$/i);
});

test("CORS rejects unknown browser origins", async () => {
  const response = await request(app).get("/health/live").set("Origin", "https://attacker.example");
  assert.equal(response.status, 403);
  assert.match(response.body.message, /CORS/i);
});

test("protected APIs reject missing authentication", async () => {
  const [chat, documents, conversations, dataExport] = await Promise.all([
    request(app).post("/api/chat").send({ message: "hello" }),
    request(app).get("/api/documents"),
    request(app).get("/api/conversations"),
    request(app).get("/api/auth/data-export"),
  ]);
  assert.equal(chat.status, 401);
  assert.equal(documents.status, 401);
  assert.equal(conversations.status, 401);
  assert.equal(dataExport.status, 401);
});

test("refresh rejects requests without a matching CSRF token", async () => {
  const response = await request(app).post("/api/auth/refresh").send({});
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "CSRF_VALIDATION_FAILED");
});

test("legal metadata endpoint is available without authentication", async () => {
  const response = await request(app).get("/api/legal");
  assert.equal(response.status, 200);
  assert.ok("privacyVersion" in response.body);
});

test("outdated policy acceptance is blocked from data-processing features", () => {
  const req = { user: { legalAcceptance: { privacyVersion: "old", termsVersion: "old" } } };
  let statusCode = 200;
  let payload;
  const res = { status(code) { statusCode = code; return this; }, json(body) { payload = body; return this; } };
  let nextCalled = false;
  requireCurrentPolicies(req, res, () => { nextCalled = true; });
  assert.equal(statusCode, 403);
  assert.equal(payload.code, "POLICY_ACCEPTANCE_REQUIRED");
  assert.equal(nextCalled, false);
});

test("unverified accounts are blocked from sensitive features", () => {
  const req = { user: { emailVerified: false } };
  let statusCode = 200;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };
  let nextCalled = false;
  requireVerifiedEmail(req, res, () => { nextCalled = true; });
  assert.equal(statusCode, 403);
  assert.equal(payload.code, "EMAIL_VERIFICATION_REQUIRED");
  assert.equal(nextCalled, false);
});

test("Yelp requests use bearer authentication", () => {
  assert.deepEqual(toolService._test.yelpHeaders("test-key"), { Authorization: "Bearer test-key" });
});

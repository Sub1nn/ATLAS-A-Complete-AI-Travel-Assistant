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

test("public auth configuration exposes capabilities without secrets", async () => {
  const previousMode = process.env.EMAIL_VERIFICATION_MODE;
  const previousRecovery = process.env.PASSWORD_RECOVERY_ENABLED;
  process.env.EMAIL_VERIFICATION_MODE = "optional";
  process.env.PASSWORD_RECOVERY_ENABLED = "false";

  const response = await request(app).get("/api/auth/config");

  if (previousMode === undefined) delete process.env.EMAIL_VERIFICATION_MODE;
  else process.env.EMAIL_VERIFICATION_MODE = previousMode;
  if (previousRecovery === undefined) delete process.env.PASSWORD_RECOVERY_ENABLED;
  else process.env.PASSWORD_RECOVERY_ENABLED = previousRecovery;

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    publicPreview: true,
    emailVerificationRequired: false,
    passwordRecoveryEnabled: false,
  });
  assert.equal(JSON.stringify(response.body).includes("MAILTRAP"), false);
});

test("disabled password recovery fails immediately without querying user data", async () => {
  const previous = process.env.PASSWORD_RECOVERY_ENABLED;
  process.env.PASSWORD_RECOVERY_ENABLED = "false";
  const response = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "visitor@example.com" });
  if (previous === undefined) delete process.env.PASSWORD_RECOVERY_ENABLED;
  else process.env.PASSWORD_RECOVERY_ENABLED = previous;

  assert.equal(response.status, 503);
  assert.equal(response.body.code, "PASSWORD_RECOVERY_DISABLED");
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
  const previousMode = process.env.EMAIL_VERIFICATION_MODE;
  process.env.EMAIL_VERIFICATION_MODE = "required";
  const req = { user: { emailVerified: false } };
  let statusCode = 200;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };
  let nextCalled = false;
  requireVerifiedEmail(req, res, () => { nextCalled = true; });
  if (previousMode === undefined) delete process.env.EMAIL_VERIFICATION_MODE;
  else process.env.EMAIL_VERIFICATION_MODE = previousMode;
  assert.equal(statusCode, 403);
  assert.equal(payload.code, "EMAIL_VERIFICATION_REQUIRED");
  assert.equal(nextCalled, false);
});

test("public preview permits an unverified account without marking it verified", () => {
  const previousMode = process.env.EMAIL_VERIFICATION_MODE;
  process.env.EMAIL_VERIFICATION_MODE = "optional";
  const req = { user: { emailVerified: false } };
  let nextCalled = false;

  requireVerifiedEmail(req, {}, () => { nextCalled = true; });

  if (previousMode === undefined) delete process.env.EMAIL_VERIFICATION_MODE;
  else process.env.EMAIL_VERIFICATION_MODE = previousMode;
  assert.equal(nextCalled, true);
  assert.equal(req.user.emailVerified, false);
});

test("Yelp requests use bearer authentication", () => {
  assert.deepEqual(toolService._test.yelpHeaders("test-key"), { Authorization: "Bearer test-key" });
});

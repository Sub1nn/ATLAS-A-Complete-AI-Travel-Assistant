import test from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_TRANSPORT_MAILTRAP_SANDBOX,
  EMAIL_TRANSPORT_RESEND,
  mailtrapSandboxConfig,
  selectedEmailTransport,
} from "../config/emailTransport.js";
import { assertProductionEnvironment } from "../utils/security.js";

function withEnvironment(overrides, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const secureProductionEnvironment = {
  NODE_ENV: "production",
  DEPLOYMENT_ENV: "staging",
  EMAIL_VERIFICATION_MODE: "required",
  PASSWORD_RECOVERY_ENABLED: "false",
  EMAIL_TRANSPORT: EMAIL_TRANSPORT_MAILTRAP_SANDBOX,
  EMAIL_FROM: "ATLAS <staging@atlas.example>",
  MAILTRAP_SMTP_HOST: "sandbox.smtp.mailtrap.io",
  MAILTRAP_SMTP_PORT: "2525",
  MAILTRAP_SMTP_USER: "sandbox-user",
  MAILTRAP_SMTP_PASS: "sandbox-password",
  RESEND_API_KEY: undefined,
  JWT_SECRET: "a-secure-production-secret-that-is-longer-than-thirty-two-characters",
  MONGODB_URI: "mongodb://mongo:27017/atlas_travel?replicaSet=rs0",
  GROQ_API_KEY: "gsk_test_key",
  APP_BASE_URL: "https://atlas.example",
  CORS_ORIGIN: "https://atlas.example",
  PRIVACY_POLICY_VERSION: "2026-06-22",
  TERMS_VERSION: "2026-06-22",
  METRICS_TOKEN: "secure-metrics-token",
  ERROR_REPORTING_WEBHOOK_URL: "https://errors.example/atlas",
  LEGAL_OPERATOR_NAME: "ATLAS",
  PRIVACY_CONTACT_EMAIL: "privacy@atlas.example",
  LEGAL_JURISDICTION: "Finland",
  PRIVACY_LAWFUL_BASIS: "Consent and contract",
  PRIVACY_TRANSFER_SAFEGUARDS: "Contractual safeguards",
  PRIVACY_SUPERVISORY_AUTHORITY: "Data Protection Ombudsman",
  GLOBAL_DAILY_PROVIDER_CALL_LIMIT: "100",
  GLOBAL_DAILY_LLM_CALL_LIMIT: "50",
  MONGODB_TRANSACTIONS: "true",
  WORKERS_REQUIRED: "true",
  REDIS_REQUIRED: "false",
  PINECONE_ENABLED: "false",
  ATLAS_AGENT_GRAPH_ENABLED: "false",
  LANGSMITH_TRACING: "false",
  ATLAS_LANGSMITH_TRACING: "false",
};

test("Resend remains the default email transport", () => {
  withEnvironment({ EMAIL_TRANSPORT: undefined }, () => {
    assert.equal(selectedEmailTransport(), EMAIL_TRANSPORT_RESEND);
  });
});

test("Mailtrap Sandbox SMTP settings are bounded for staging", () => {
  withEnvironment(secureProductionEnvironment, () => {
    const config = mailtrapSandboxConfig();
    assert.equal(selectedEmailTransport(), EMAIL_TRANSPORT_MAILTRAP_SANDBOX);
    assert.equal(config.host, "sandbox.smtp.mailtrap.io");
    assert.equal(config.port, 2525);
    assert.equal(config.secure, false);
    assert.equal(config.pool, true);
    assert.equal(config.maxConnections, 2);
    assert.equal(config.disableFileAccess, true);
    assert.equal(config.disableUrlAccess, true);
  });
});

test("Mailtrap Sandbox is rejected outside staging", () => {
  withEnvironment({ ...secureProductionEnvironment, DEPLOYMENT_ENV: "production" }, () => {
    assert.throws(assertProductionEnvironment, /allowed only when DEPLOYMENT_ENV=staging/i);
  });
});

test("staging can use Mailtrap Sandbox without a Resend key", () => {
  withEnvironment(secureProductionEnvironment, () => {
    assert.doesNotThrow(assertProductionEnvironment);
  });
});

test("Mailtrap Sandbox cannot advertise password recovery to public visitors", () => {
  withEnvironment({
    ...secureProductionEnvironment,
    PASSWORD_RECOVERY_ENABLED: "true",
  }, () => {
    assert.throws(assertProductionEnvironment, /PASSWORD_RECOVERY_ENABLED=false/);
  });
});

test("production defaults to Resend and requires its API key", () => {
  withEnvironment({
    ...secureProductionEnvironment,
    DEPLOYMENT_ENV: "production",
    EMAIL_TRANSPORT: EMAIL_TRANSPORT_RESEND,
    RESEND_API_KEY: undefined,
  }, () => {
    assert.throws(assertProductionEnvironment, /RESEND_API_KEY/);
  });
});

test("optional email verification is accepted for a staging preview", () => {
  withEnvironment({
    ...secureProductionEnvironment,
    EMAIL_VERIFICATION_MODE: "optional",
  }, () => {
    assert.doesNotThrow(assertProductionEnvironment);
  });
});

test("optional email verification is rejected for a production deployment", () => {
  withEnvironment({
    ...secureProductionEnvironment,
    DEPLOYMENT_ENV: "production",
    EMAIL_VERIFICATION_MODE: "optional",
  }, () => {
    assert.throws(assertProductionEnvironment, /allowed only for development or staging previews/i);
  });
});

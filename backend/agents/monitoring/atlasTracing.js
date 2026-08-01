import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import { logger } from "../../utils/logger.js";

const SENSITIVE_KEY = /api[_-]?key|authorization|content|document|email|input|message|output|password|prompt|query|secret|token/i;
const SAFE_STRING_KEY = /answerStyle|environment|graphVersion|intent|locationScope|operation|phase|provider|runType|status|tool|warningCode/i;

let langSmithClient;
let langSmithAvailabilityPromise;

function numericRate(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function summarizeValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return { type: "string", characters: value.length };
  if (Array.isArray(value)) return { type: "array", count: value.length };
  if (typeof value !== "object") return { type: typeof value };
  if (depth >= 2) return { type: "object", fieldCount: Object.keys(value).length };

  const summary = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      summary[key] = summarizeValue(child, depth + 1);
    } else if (typeof child === "string" && SAFE_STRING_KEY.test(key)) {
      summary[key] = child.slice(0, 80);
    } else if (typeof child === "boolean" || typeof child === "number" || child === null) {
      summary[key] = child;
    } else {
      summary[key] = summarizeValue(child, depth + 1);
    }
  }
  return summary;
}

function sanitizeMetadata(metadata = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "string" && SAFE_STRING_KEY.test(key)) clean[key] = value.slice(0, 80);
    else if (["number", "boolean"].includes(typeof value)) clean[key] = value;
    else if (Array.isArray(value)) clean[`${key}Count`] = value.length;
  }
  return clean;
}

function sanitizedTraceConfig(name, client, metadata = {}, tags = [], runType = "chain") {
  return {
    name,
    run_type: runType,
    project_name: process.env.LANGSMITH_PROJECT || "atlas-travel-assistant",
    client,
    // Automatic SDK tracing is disabled to protect prompts and graph state.
    // Explicitly enable only this ATLAS-sanitized wrapper.
    tracingEnabled: true,
    metadata: sanitizeMetadata(metadata),
    tags: ["atlas", ...tags].slice(0, 12),
    processInputs: () => ({ operation: name }),
    processOutputs: (outputs) => summarizeValue(outputs),
  };
}

export function langSmithTracingEnabled() {
  // ATLAS emits privacy-sanitized traces through its own Client. Turn off the
  // SDK's environment-driven auto tracer before invoking LangChain/LangGraph;
  // otherwise raw prompts and graph state could be emitted by nested runs.
  if (process.env.LANGSMITH_TRACING === "true") {
    process.env.ATLAS_LANGSMITH_TRACING = "true";
    process.env.LANGSMITH_TRACING = "false";
  }
  return process.env.ATLAS_LANGSMITH_TRACING === "true" && Boolean(process.env.LANGSMITH_API_KEY);
}

export function getLangSmithClient() {
  if (!langSmithTracingEnabled()) return null;
  if (langSmithClient) return langSmithClient;

  langSmithClient = new Client({
    apiKey: process.env.LANGSMITH_API_KEY,
    apiUrl: process.env.LANGSMITH_ENDPOINT || undefined,
    workspaceId: process.env.LANGSMITH_WORKSPACE_ID || undefined,
    tracingSamplingRate: numericRate(process.env.LANGSMITH_TRACING_SAMPLING_RATE, 0.1),
    hideInputs: (inputs) => summarizeValue(inputs),
    hideOutputs: (outputs) => summarizeValue(outputs),
    hideMetadata: (metadata) => sanitizeMetadata(metadata),
    omitTracedRuntimeInfo: process.env.LANGSMITH_OMIT_RUNTIME_INFO !== "false",
  });
  return langSmithClient;
}

async function getAvailableLangSmithClient() {
  const client = getLangSmithClient();
  if (!client) return null;
  if (process.env.LANGSMITH_CONNECTION_CHECK === "false") return client;
  langSmithAvailabilityPromise ||= (async () => {
    try {
      for await (const _project of client.listProjects({ limit: 1 })) break;
      return client;
    } catch (error) {
      logger.warn("LangSmith tracing disabled because the configured credentials were rejected", {
        status: Number(error?.status || error?.statusCode || 0) || undefined,
        hint: "Create a new LangSmith API key and set LANGSMITH_WORKSPACE_ID when the account uses multiple workspaces.",
      });
      return null;
    }
  })();
  return langSmithAvailabilityPromise;
}

export async function traceAtlasOperation(name, metadata, operation, { runType = "chain", tags = [] } = {}) {
  const client = await getAvailableLangSmithClient();
  if (!client) return operation();

  const traced = traceable(
    async () => operation(),
    sanitizedTraceConfig(name, client, metadata, tags, runType),
  );
  return traced();
}

export async function runWithoutAutomaticTracing(operation) {
  const untraced = traceable(
    async () => operation(),
    {
      name: "atlas-private-operation",
      tracingEnabled: false,
    },
  );
  return untraced();
}

export const atlasTracingTestUtils = {
  sanitizeMetadata,
  sanitizedTraceConfig,
  summarizeValue,
};

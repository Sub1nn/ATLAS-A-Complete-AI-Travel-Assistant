import axios from "axios";
import { ChatGroq } from "@langchain/groq";
import { logger } from "../utils/logger.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_MODEL_DEFAULTS = Object.freeze({
  planner: "openai/gpt-oss-20b",
  response: "openai/gpt-oss-120b",
  general: "openai/gpt-oss-120b",
  fallback: "llama-3.3-70b-versatile",
});

const MODEL_ENV_KEYS = Object.freeze({
  planner: "GROQ_PLANNER_MODEL",
  response: "GROQ_RESPONSE_MODEL",
  general: "GROQ_MODEL",
});

function cleanModelName(value = "") {
  return String(value || "").trim();
}

export function groqModelFor(role = "general") {
  const normalizedRole = Object.hasOwn(MODEL_ENV_KEYS, role) ? role : "general";
  const roleModel = cleanModelName(process.env[MODEL_ENV_KEYS[normalizedRole]]);
  if (roleModel) return roleModel;

  const generalModel = cleanModelName(process.env.GROQ_MODEL);
  if (generalModel) return generalModel;
  return GROQ_MODEL_DEFAULTS[normalizedRole];
}

export function groqFallbackModel() {
  return cleanModelName(process.env.GROQ_FALLBACK_MODEL) || GROQ_MODEL_DEFAULTS.fallback;
}

export function groqModelCandidates(role = "general") {
  const candidates = [groqModelFor(role)];
  if (process.env.GROQ_MODEL_FALLBACK_ENABLED !== "false") {
    candidates.push(groqFallbackModel());
  }
  return [...new Set(candidates.filter(Boolean))];
}

export function supportsGroqJsonSchema(model = "") {
  return cleanModelName(model).startsWith("openai/gpt-oss");
}

export function structuredOutputOptions(model, name) {
  return {
    name,
    method: supportsGroqJsonSchema(model) ? "jsonSchema" : "functionCalling",
  };
}

function errorStatus(error) {
  return Number(error?.status || error?.response?.status || error?.cause?.status || 0);
}

function errorCode(error) {
  return String(error?.code || error?.cause?.code || error?.response?.data?.error?.code || "").toUpperCase();
}

function errorMessage(error) {
  return [
    error?.message,
    error?.response?.data?.error?.message,
    error?.response?.data?.error?.code,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function isGroqAbort(error, signal) {
  return Boolean(
    signal?.aborted
    || error?.name === "AbortError"
    || ["ABORT_ERR", "ERR_ABORTED", "ERR_CANCELED"].includes(errorCode(error)),
  );
}

export function shouldTryGroqFallback(error, signal) {
  if (isGroqAbort(error, signal)) return false;

  const status = errorStatus(error);
  if ([401, 403].includes(status)) return false;
  if ([404, 408, 409, 425, 429].includes(status) || status >= 500) return true;

  const code = errorCode(error);
  if ([
    "ECONNABORTED",
    "ECONNRESET",
    "ECONNREFUSED",
    "ENETUNREACH",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
  ].includes(code)) return true;

  const message = errorMessage(error);
  return /(?:failed_generation|json|schema|structured output|tool call|no tool calls|parse|timeout|timed out|rate limit|overloaded|unavailable)/i.test(message);
}

export async function runWithGroqModelFallback({ role = "general", operation = "groq_request", signal, invoke }) {
  const candidates = groqModelCandidates(role);
  let lastError;

  for (let index = 0; index < candidates.length; index += 1) {
    const model = candidates[index];
    try {
      const value = await invoke(model);
      if (index > 0) {
        logger.warn("Groq model fallback succeeded", {
          operation,
          role,
          model,
          primaryModel: candidates[0],
        });
      }
      return value;
    } catch (error) {
      lastError = error;
      const hasFallback = index < candidates.length - 1;
      if (!hasFallback || !shouldTryGroqFallback(error, signal)) throw error;
      logger.warn("Groq primary model unavailable; trying configured fallback", {
        operation,
        role,
        model,
        fallbackModel: candidates[index + 1],
        status: errorStatus(error) || undefined,
        reason: String(error?.message || "Groq request failed").slice(0, 220),
      });
    }
  }

  throw lastError || new Error("No Groq model is configured");
}

export async function invokeStructuredGroq({
  role,
  operation,
  schema,
  schemaName,
  messages,
  invokeOptions = {},
  temperature = 0,
  maxTokens,
  timeout,
  signal,
}) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  return runWithGroqModelFallback({
    role,
    operation,
    signal,
    invoke: async (modelName) => {
      const model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: modelName,
        temperature,
        maxTokens,
        maxRetries: 0,
        timeout,
        callbacks: [],
        ...(supportsGroqJsonSchema(modelName)
          ? { reasoningEffort: role === "planner" ? "low" : "medium" }
          : {}),
      });
      const structuredModel = model.withStructuredOutput(
        schema,
        structuredOutputOptions(modelName, schemaName),
      );
      return structuredModel.invoke(messages, { ...invokeOptions, signal });
    },
  });
}

export async function postGroqChat({
  role = "general",
  operation = "groq_chat_completion",
  payload,
  timeout = 45000,
  signal,
}) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  return runWithGroqModelFallback({
    role,
    operation,
    signal,
    invoke: async (modelName) => axios.post(
      GROQ_URL,
      { ...payload, model: modelName },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout,
        signal,
      },
    ),
  });
}

export const groqModelServiceTestUtils = {
  errorStatus,
  errorCode,
};

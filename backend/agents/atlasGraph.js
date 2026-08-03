import crypto from "crypto";
import mongoose from "mongoose";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { databaseReady } from "../db/mongoose.js";
import { logger } from "../utils/logger.js";
import { groqFallbackModel, groqModelFor } from "../services/groqModelService.js";
import { AtlasState } from "./atlasState.js";
import { AuthoritativeAtlasState } from "./authoritativeState.js";
import { withAgentRuntime } from "./agentRuntime.js";
import { assessContextNode, finalizeShadowNode, resolveContextNode } from "./nodes/contextNodes.js";
import {
  composeResponseNode,
  executeToolsNode,
  finalizeAuthoritativeNode,
  guardrailNode,
  planRequestNode,
  qualityGateNode,
  reconcileEvidenceNode,
  repairResponseNode,
  responsePlanNode,
  resolveRequestNode,
  retrieveEvidenceNode,
  routeAfterGuardrail,
  routeAfterQualityGate,
  routeToolsNode,
  shortCircuitNode,
  supervisorNode,
  verifyResponseNode,
} from "./nodes/orchestrationNodes.js";
import { runWithoutAutomaticTracing, traceAtlasOperation } from "./monitoring/atlasTracing.js";

const CHECKPOINT_COLLECTION = "atlas_agent_checkpoints";
const CHECKPOINT_WRITES_COLLECTION = "atlas_agent_checkpoint_writes";

let graphPromise;
let checkpointPromise;
let authoritativeGraph;
let hybridAuthoritativeGraph;

export function agentShadowModeEnabled() {
  return process.env.ATLAS_AGENT_SHADOW_MODE === "true";
}

export function agentGraphEnabled() {
  return process.env.ATLAS_AGENT_GRAPH_ENABLED === "true";
}

export function agentHybridWorkflowEnabled() {
  return process.env.ATLAS_AGENT_HYBRID_ENABLED === "true";
}

export function shouldUseAtlasAuthoritativeGraph(userId) {
  if (!agentGraphEnabled()) return false;
  const fallbackPercent = process.env.NODE_ENV === "production" ? 0 : 100;
  const canaryPercent = Math.max(0, Math.min(100, Number(process.env.ATLAS_AGENT_CANARY_PERCENT ?? fallbackPercent)));
  if (canaryPercent <= 0) return false;
  if (canaryPercent >= 100) return true;
  const bucket = crypto.createHash("sha256").update(String(userId || "")).digest().readUInt32BE(0) % 100;
  return bucket < canaryPercent;
}

export async function initializeAtlasGraph() {
  const shadowEnabled = agentShadowModeEnabled();
  const authoritativeEnabled = agentGraphEnabled();
  if (!shadowEnabled && !authoritativeEnabled) return { enabled: false };
  if (shadowEnabled) await getGraph();
  if (authoritativeEnabled) getAuthoritativeGraph();
  logger.info("ATLAS agent graph initialized", {
    mode: authoritativeEnabled ? "authoritative-canary" : "shadow",
    canaryPercent: authoritativeEnabled ? Number(process.env.ATLAS_AGENT_CANARY_PERCENT ?? (process.env.NODE_ENV === "production" ? 0 : 100)) : 0,
    checkpointBackend: shadowEnabled
      ? process.env.NODE_ENV === "test" && process.env.ATLAS_AGENT_CHECKPOINT_BACKEND !== "mongodb"
        ? "memory"
        : "mongodb"
      : "disabled-for-authoritative-graph",
    graphVersion: authoritativeEnabled && agentHybridWorkflowEnabled()
      ? "travel-supervisor-v3"
      : authoritativeEnabled
      ? "travel-orchestrator-v2"
      : "context-shadow-v1",
    llmModels: {
      planner: groqModelFor("planner"),
      response: groqModelFor("response"),
      fallback: process.env.GROQ_MODEL_FALLBACK_ENABLED === "false" ? "disabled" : groqFallbackModel(),
    },
  });
  return { enabled: true, mode: authoritativeEnabled ? "authoritative-canary" : "shadow" };
}

export function atlasThreadId(userId, conversationId) {
  const digest = crypto
    .createHash("sha256")
    .update(`${String(userId || "")}:${String(conversationId || "")}`)
    .digest("hex");
  return `atlas:${digest}`;
}

function buildGraph(checkpointer) {
  return new StateGraph(AtlasState)
    .addNode("resolve_context", resolveContextNode)
    .addNode("assess_context", assessContextNode)
    .addNode("finalize_shadow", finalizeShadowNode)
    .addEdge(START, "resolve_context")
    .addEdge("resolve_context", "assess_context")
    .addEdge("assess_context", "finalize_shadow")
    .addEdge("finalize_shadow", END)
    .compile({ checkpointer });
}

function buildAuthoritativeGraph() {
  return new StateGraph(AuthoritativeAtlasState)
    .addNode("resolve_context", resolveRequestNode)
    .addNode("plan_request", planRequestNode)
    .addNode("retrieve_evidence", retrieveEvidenceNode)
    .addNode("route_tools", routeToolsNode)
    .addNode("execute_tools", executeToolsNode)
    .addNode("compose_response", composeResponseNode)
    .addNode("verify_response", verifyResponseNode)
    .addNode("quality_gate", qualityGateNode)
    .addNode("repair_response", repairResponseNode)
    .addNode("finalize", finalizeAuthoritativeNode)
    .addEdge(START, "resolve_context")
    .addEdge("resolve_context", "plan_request")
    .addEdge("plan_request", "retrieve_evidence")
    .addEdge("retrieve_evidence", "route_tools")
    .addEdge("route_tools", "execute_tools")
    .addEdge("execute_tools", "compose_response")
    .addEdge("compose_response", "verify_response")
    .addEdge("verify_response", "quality_gate")
    .addEdge("quality_gate", "repair_response")
    .addEdge("repair_response", "finalize")
    .addEdge("finalize", END)
    // This graph intentionally has no checkpointer. Provider responses, document
    // excerpts and guest inputs remain request-scoped and are never duplicated
    // into LangGraph storage.
    .compile();
}

function buildHybridAuthoritativeGraph() {
  return new StateGraph(AuthoritativeAtlasState)
    .addNode("resolve_context", resolveRequestNode)
    .addNode("plan_request", planRequestNode)
    .addNode("apply_guardrails", guardrailNode)
    .addNode("short_circuit", shortCircuitNode)
    .addNode("supervise_request", supervisorNode)
    .addNode("retrieve_evidence", retrieveEvidenceNode)
    .addNode("route_tools", routeToolsNode)
    .addNode("execute_specialists", executeToolsNode)
    .addNode("reconcile_evidence", reconcileEvidenceNode)
    .addNode("plan_response", responsePlanNode)
    .addNode("compose_response", composeResponseNode)
    .addNode("verify_response", verifyResponseNode)
    .addNode("quality_gate", qualityGateNode)
    .addNode("repair_response", repairResponseNode)
    .addNode("finalize", finalizeAuthoritativeNode)
    .addEdge(START, "resolve_context")
    .addEdge("resolve_context", "plan_request")
    .addEdge("plan_request", "apply_guardrails")
    .addConditionalEdges("apply_guardrails", routeAfterGuardrail, {
      supervise: "supervise_request",
      short_circuit: "short_circuit",
    })
    .addEdge("short_circuit", "finalize")
    .addEdge("supervise_request", "retrieve_evidence")
    .addEdge("retrieve_evidence", "route_tools")
    .addEdge("route_tools", "execute_specialists")
    .addEdge("execute_specialists", "reconcile_evidence")
    .addEdge("reconcile_evidence", "plan_response")
    .addEdge("plan_response", "compose_response")
    .addEdge("compose_response", "verify_response")
    .addEdge("verify_response", "quality_gate")
    .addConditionalEdges("quality_gate", routeAfterQualityGate, {
      finalize: "finalize",
      repair: "repair_response",
    })
    .addEdge("repair_response", "finalize")
    .addEdge("finalize", END)
    // Provider responses and document excerpts remain request-scoped. Durable
    // conversation memory is persisted by the controller after lease fencing.
    .compile();
}

function getAuthoritativeGraph() {
  if (agentHybridWorkflowEnabled()) {
    hybridAuthoritativeGraph ||= buildHybridAuthoritativeGraph();
    return hybridAuthoritativeGraph;
  }
  authoritativeGraph ||= buildAuthoritativeGraph();
  return authoritativeGraph;
}

async function createCheckpointer() {
  if (process.env.NODE_ENV === "test" && process.env.ATLAS_AGENT_CHECKPOINT_BACKEND !== "mongodb") {
    return new MemorySaver();
  }
  if (!databaseReady()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LangGraph requires an active MongoDB connection in production.");
    }
    logger.warn("LangGraph is using in-memory checkpoints because MongoDB is unavailable.");
    return new MemorySaver();
  }

  const ttl = Math.max(3600, Number(process.env.ATLAS_AGENT_CHECKPOINT_TTL_SECONDS || 7 * 24 * 60 * 60));
  const saver = new MongoDBSaver({
    client: mongoose.connection.getClient(),
    dbName: process.env.ATLAS_AGENT_CHECKPOINT_DB || mongoose.connection.name,
    checkpointCollectionName: CHECKPOINT_COLLECTION,
    checkpointWritesCollectionName: CHECKPOINT_WRITES_COLLECTION,
    ttl,
  });
  const setupErrors = await saver.setup();
  if (setupErrors.length) throw new AggregateError(setupErrors, "LangGraph checkpoint setup failed");
  return saver;
}

async function getCheckpointer() {
  checkpointPromise ||= createCheckpointer().catch((error) => {
    checkpointPromise = null;
    throw error;
  });
  return checkpointPromise;
}

async function getGraph() {
  graphPromise ||= getCheckpointer()
    .then(buildGraph)
    .catch((error) => {
      graphPromise = null;
      throw error;
    });
  return graphPromise;
}

function compactHistory(previousMessages = []) {
  return previousMessages.slice(-8).map((item) => ({
    role: item.role === "assistant" ? "assistant" : "user",
    content: String(item.content || "").slice(0, 500),
  }));
}

function linkedAbortSignal(signal, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  timer.unref();
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  };
}

export async function runAtlasShadowWorkflow({
  message,
  memory,
  previousMessages,
  planner,
  temporalContext,
  userId,
  conversationId,
  signal,
} = {}) {
  if (!agentShadowModeEnabled()) return null;
  const timeoutMs = Math.max(250, Number(process.env.ATLAS_AGENT_SHADOW_TIMEOUT_MS || 1500));
  const linked = linkedAbortSignal(signal, timeoutMs);

  try {
    return await traceAtlasOperation(
      "atlas-agent-shadow",
      { graphVersion: "context-shadow-v1", environment: process.env.NODE_ENV || "development" },
      async () => {
        const graph = await getGraph();
        const output = await runWithoutAutomaticTracing(() => graph.invoke(
          {
            schemaVersion: 1,
            message: String(message || "").slice(0, 3000),
            memory: memory || {},
            previousMessages: compactHistory(previousMessages),
            planner: planner || null,
            temporalContext: temporalContext || {},
          },
          {
            configurable: { thread_id: atlasThreadId(userId, conversationId) },
            signal: linked.signal,
            tags: ["atlas", "shadow"],
            metadata: { graphVersion: "context-shadow-v1" },
          },
        ));
        return output.result;
      },
      { tags: ["shadow", "context"] },
    );
  } finally {
    linked.dispose();
  }
}

export async function runAtlasAuthoritativeWorkflow({
  message,
  memory,
  previousMessages,
  documentFocused = false,
  runtime,
  signal,
} = {}) {
  if (!agentGraphEnabled()) return null;
  const timeoutMs = Math.max(5000, Number(process.env.ATLAS_AGENT_REQUEST_TIMEOUT_MS || 60000));
  const linked = linkedAbortSignal(signal, timeoutMs);
  const graphVersion = agentHybridWorkflowEnabled() ? "travel-supervisor-v3" : "travel-orchestrator-v2";

  try {
    return await traceAtlasOperation(
      "atlas-agent-authoritative",
      {
        graphVersion,
        environment: process.env.NODE_ENV || "development",
        documentFocused: Boolean(documentFocused),
      },
      () => withAgentRuntime(runtime, async () => {
        const output = await runWithoutAutomaticTracing(() => getAuthoritativeGraph().invoke(
          {
            schemaVersion: 2,
            graphVersion,
            message: String(message || "").slice(0, 3000),
            memory: memory || {},
            previousMessages: compactHistory(previousMessages),
            documentFocused: Boolean(documentFocused),
          },
          {
            signal: linked.signal,
            callbacks: [],
            tags: ["atlas", "authoritative"],
            metadata: { graphVersion },
          },
        ));
        return output.result;
      }),
      { tags: ["authoritative", "orchestration"] },
    );
  } finally {
    linked.dispose();
  }
}

export async function deleteAtlasConversationThread(userId, conversationId) {
  if (!databaseReady()) return { deleted: false, reason: "database_unavailable" };
  const threadId = atlasThreadId(userId, conversationId);
  const db = mongoose.connection.getClient().db(process.env.ATLAS_AGENT_CHECKPOINT_DB || mongoose.connection.name);
  const [checkpoints, writes] = await Promise.all([
    db.collection(CHECKPOINT_COLLECTION).deleteMany({ thread_id: threadId }),
    db.collection(CHECKPOINT_WRITES_COLLECTION).deleteMany({ thread_id: threadId }),
  ]);
  return { deleted: true, count: Number(checkpoints.deletedCount || 0) + Number(writes.deletedCount || 0) };
}

export async function deleteAtlasUserThreads(userId, conversationIds = []) {
  if (!databaseReady()) return { deleted: false, reason: "database_unavailable" };
  const threadIds = [...new Set(conversationIds.map((conversationId) => atlasThreadId(userId, conversationId)))];
  if (!threadIds.length) return { deleted: true, count: 0 };
  const db = mongoose.connection.getClient().db(process.env.ATLAS_AGENT_CHECKPOINT_DB || mongoose.connection.name);
  const filter = { thread_id: { $in: threadIds } };
  const [checkpoints, writes] = await Promise.all([
    db.collection(CHECKPOINT_COLLECTION).deleteMany(filter),
    db.collection(CHECKPOINT_WRITES_COLLECTION).deleteMany(filter),
  ]);
  return { deleted: true, count: Number(checkpoints.deletedCount || 0) + Number(writes.deletedCount || 0) };
}

export const atlasGraphTestUtils = {
  buildGraph,
  buildAuthoritativeGraph,
  buildHybridAuthoritativeGraph,
  compactHistory,
};

import { getAgentRuntime } from "../agentRuntime.js";
import { traceAtlasOperation } from "../monitoring/atlasTracing.js";
import {
  createResponsePlan,
  createSpecialistPlan,
  createSupervisorDecision,
  evaluateTravelGuardrails,
  reconcileSpecialistEvidence,
  renderGuardrailResponse,
} from "../hybridWorkflow.js";

function tracedNode(name, state, operation) {
  const graphVersion = process.env.ATLAS_AGENT_HYBRID_ENABLED === "true"
    ? "travel-supervisor-v3"
    : "travel-orchestrator-v2";
  return traceAtlasOperation(
    name,
    {
      phase: name.replace(/^atlas-agent-/, ""),
      graphVersion,
      intent: state.resolved?.intent?.type || state.baseResolved?.intent?.type || "unknown",
      toolCount: state.toolResults?.length || state.toolsToUse?.length || 0,
    },
    operation,
    { tags: ["authoritative", "node"] },
  );
}

export function resolveRequestNode(state) {
  return tracedNode("atlas-agent-context", state, async () => {
    const runtime = getAgentRuntime();
    const baseResolved = await runtime.resolveContext({
      message: state.message,
      memory: state.memory,
      previousMessages: state.previousMessages,
    });
    return { baseResolved, resolved: baseResolved };
  });
}

export function planRequestNode(state) {
  return tracedNode("atlas-agent-plan", state, async () => {
    const runtime = getAgentRuntime();
    if (state.documentFocused) return { planner: null, resolved: state.baseResolved };
    const planned = await runtime.planRequest({
      message: state.message,
      memory: state.memory,
      previousMessages: state.previousMessages,
      baseResolved: state.baseResolved,
    });
    return {
      planner: planned?.planner || null,
      resolved: planned?.resolved || state.baseResolved,
    };
  });
}

export function guardrailNode(state) {
  return tracedNode("atlas-agent-guardrail", state, async () => ({
    guardrail: evaluateTravelGuardrails({
      message: state.message,
      resolved: state.resolved,
      documentFocused: state.documentFocused,
    }),
  }));
}

export function routeAfterGuardrail(state) {
  return state.guardrail?.status === "allow" ? "supervise" : "short_circuit";
}

export function shortCircuitNode(state) {
  return tracedNode("atlas-agent-short-circuit", state, async () => {
    const answer = renderGuardrailResponse(state.guardrail);
    return {
      answer,
      verificationResult: {
        answer,
        verification: { modified: false, notes: state.guardrail?.reasonCodes || [] },
      },
      quality: assessResponseQuality({
        answer,
        resolved: state.resolved,
        memory: state.memory,
        message: state.message,
      }),
    };
  });
}

export function supervisorNode(state) {
  return tracedNode("atlas-agent-supervisor", state, async () => ({
    supervisor: createSupervisorDecision({
      message: state.message,
      resolved: state.resolved,
      documentFocused: state.documentFocused,
      guardrail: state.guardrail,
    }),
  }));
}

export function retrieveEvidenceNode(state) {
  return tracedNode("atlas-agent-retrieve", state, async () => {
    const runtime = getAgentRuntime();
    const retrievedDocs = await runtime.retrieveDocuments({
      message: state.message,
      resolved: state.resolved,
      documentFocused: state.documentFocused,
    });
    return { retrievedDocs: retrievedDocs || [] };
  });
}

export function routeToolsNode(state) {
  return tracedNode("atlas-agent-route-tools", state, async () => {
    const runtime = getAgentRuntime();
    const toolsToUse = await runtime.selectTools({
      message: state.message,
      resolved: state.resolved,
      documentFocused: state.documentFocused,
    });
    const selectedTools = toolsToUse || [];
    if (!state.supervisor) return { toolsToUse: selectedTools };
    const specialistPlan = createSpecialistPlan({
      supervisor: state.supervisor,
      toolsToUse: selectedTools,
    });
    return {
      specialistPlan,
      toolsToUse: specialistPlan.flatMap((item) => item.tools),
    };
  });
}

export function executeToolsNode(state) {
  return tracedNode("atlas-agent-execute-tools", state, async () => {
    const runtime = getAgentRuntime();
    const execution = state.specialistPlan?.length && typeof runtime.executeSpecialists === "function"
      ? await runtime.executeSpecialists({
          specialistPlan: state.specialistPlan,
          resolved: state.resolved,
          supervisor: state.supervisor,
        })
      : await runtime.executeTools({
          toolsToUse: state.toolsToUse,
          resolved: state.resolved,
        });
    return {
      toolResults: execution?.toolResults || [],
      successfulToolResults: execution?.successfulToolResults || [],
      specialistResults: execution?.specialistResults || [],
    };
  });
}

export function reconcileEvidenceNode(state) {
  return tracedNode("atlas-agent-reconcile-evidence", state, async () => ({
    evidence: reconcileSpecialistEvidence({
      specialistPlan: state.specialistPlan,
      specialistResults: state.specialistResults,
      toolResults: state.toolResults,
      retrievedDocs: state.retrievedDocs,
    }),
  }));
}

export function responsePlanNode(state) {
  return tracedNode("atlas-agent-response-plan", state, async () => ({
    responsePlan: createResponsePlan({
      message: state.message,
      resolved: state.resolved,
      supervisor: state.supervisor,
      evidence: state.evidence,
    }),
  }));
}

export function composeResponseNode(state) {
  return tracedNode("atlas-agent-compose", state, async () => {
    const runtime = getAgentRuntime();
    const answer = await runtime.composeResponse({
      message: state.message,
      resolved: state.resolved,
      retrievedDocs: state.retrievedDocs,
      toolResults: state.toolResults,
      successfulToolResults: state.successfulToolResults,
      documentFocused: state.documentFocused,
      supervisor: state.supervisor,
      evidence: state.evidence,
      responsePlan: state.responsePlan,
    });
    return { answer: answer || "" };
  });
}

export function verifyResponseNode(state) {
  return tracedNode("atlas-agent-verify", state, async () => {
    const runtime = getAgentRuntime();
    const verificationResult = await runtime.verifyResponse({
      answer: state.answer,
      toolResults: state.successfulToolResults,
      retrievedDocs: state.retrievedDocs,
      documentFocused: state.documentFocused,
    });
    return {
      answer: verificationResult?.answer || state.answer,
      verificationResult: verificationResult || { answer: state.answer, verification: { modified: false, notes: [] } },
    };
  });
}

function normalizedHeadings(answer = "") {
  return String(answer)
    .split("\n")
    .map((line) => line.match(/^\s*(?:#{1,4}\s+|\*\*)([^*\n]+?)(?:\*\*)?\s*$/)?.[1]?.trim().toLowerCase())
    .filter(Boolean);
}

export function assessResponseQuality({ answer = "", resolved = {}, memory = {}, message = "", responsePlan = {}, evidence = {} } = {}) {
  const issues = [];
  const text = String(answer || "").trim();
  const headings = normalizedHeadings(text);
  const uniqueHeadings = new Set(headings);

  if (text.length < 80) issues.push("ANSWER_TOO_SHORT");
  if (headings.length !== uniqueHeadings.size) issues.push("DUPLICATE_HEADINGS");
  if (headings.length > 9) issues.push("EXCESSIVE_SECTIONS");
  if (/\b(?:configured source|places lead|google did not find|tool execution|api response|language model)\b/i.test(text)) {
    issues.push("INTERNAL_LANGUAGE");
  }
  if (/(?:\n\s*[•*-]\s*){9,}/.test(text)) issues.push("EXCESSIVE_LIST");

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const targetWords = Number(responsePlan?.targetWords || 0);
  if (targetWords > 0 && wordCount > Math.max(targetWords + 120, targetWords * 1.35)) issues.push("OVERLONG_RESPONSE");

  const explicitLocations = Array.isArray(resolved.explicitLocations) ? resolved.explicitLocations : [];
  const previousDestination = String(resolved.previousDestination || memory.destination || "").trim();
  const currentDestination = String(resolved.destination || resolved.locations?.[0] || "").trim();
  if (
    (explicitLocations.length || (currentDestination && currentDestination.toLowerCase() !== previousDestination.toLowerCase()))
    && previousDestination
    && currentDestination.toLowerCase() !== previousDestination.toLowerCase()
    && text.toLowerCase().includes(previousDestination.toLowerCase())
  ) {
    issues.push("STALE_DESTINATION");
  }
  if (explicitLocations.length > 1) {
    const omitted = explicitLocations.filter((location) => !text.toLowerCase().includes(String(location).toLowerCase()));
    if (omitted.length) issues.push("MULTI_DESTINATION_LOSS");
  }

  if (responsePlan?.omitRepeatedSafety && headings.some((heading) => /\b(safety|advisory|current context)\b/i.test(heading))) {
    issues.push("REPEATED_SAFETY_CONTEXT");
  }
  if (evidence?.missingRequired?.length && !/\b(could not verify|couldn.t verify|unable to verify|confirm with|official)\b/i.test(text)) {
    issues.push("EVIDENCE_GAP_NOT_DISCLOSED");
  }

  const asksForRoute = resolved.intent?.type === "route_planning";
  if (asksForRoute && !/\b(route|travel|journey|train|bus|drive|walk|cycle|transit|duration|distance)\b/i.test(text)) {
    issues.push("INTENT_MISMATCH");
  }
  if (/\b(vegetarian|vegan|halal|kosher|gluten[-\s]?free)\b/i.test(message) && !/\b(vegetarian|vegan|halal|kosher|gluten[-\s]?free|dietary)\b/i.test(text)) {
    issues.push("DIETARY_CONSTRAINT_MISSING");
  }
  const constraints = resolved.requestProfile?.constraints || memory.constraints || {};
  if (constraints.accessible && !/\b(accessib|wheelchair|step[-\s]?free|mobility|lift|elevator)\b/i.test(text)) {
    issues.push("ACCESSIBILITY_CONSTRAINT_MISSING");
  }
  if (constraints.senior && !/\b(senior|older|parent|rest|pace|seating|mobility)\b/i.test(text)) {
    issues.push("SENIOR_CONSTRAINT_MISSING");
  }
  if (constraints.minimalWalking && !/\b(minimal|limit|reduce|short|little|less)\s+(?:the\s+)?walk|\bwalking\b/i.test(text)) {
    issues.push("WALKING_CONSTRAINT_MISSING");
  }
  if (constraints.minimalTransfers && !/\b(direct|few|fewer|minimal|avoid|reduce)\b[\s\S]{0,24}\btransfers?\b|\btransfers?\b[\s\S]{0,24}\b(few|fewer|minimal|avoid|reduce)\b/i.test(text)) {
    issues.push("TRANSFER_CONSTRAINT_MISSING");
  }
  if ((constraints.indoorAlternative || constraints.rainAlternative) && !/\b(indoor|covered|rain|wet[-\s]?weather|weather backup|alternative)\b/i.test(text)) {
    issues.push("WEATHER_BACKUP_MISSING");
  }
  if (constraints.startTime && !text.includes(String(constraints.startTime).replace(/^0/, "")) && !text.includes(String(constraints.startTime))) {
    issues.push("START_TIME_MISSING");
  }
  if (Number(constraints.maxBudget) > 0 && !text.includes(String(constraints.maxBudget))) {
    issues.push("BUDGET_CONSTRAINT_MISSING");
  }
  if (constraints.breakfastPreferred && !/\bbreakfast\b/i.test(text)) {
    issues.push("BREAKFAST_CONSTRAINT_MISSING");
  }
  if (resolved.intent?.type === "accommodation_search") {
    if (constraints.checkIn && !text.includes(String(constraints.checkIn))) issues.push("CHECKIN_DATE_MISSING");
    if (Number(constraints.adults) > 0 && !new RegExp(`\\b${Number(constraints.adults)}\\s+adults?\\b`, "i").test(text)) {
      issues.push("OCCUPANCY_MISSING");
    }
    if (Array.isArray(constraints.childAges) && constraints.childAges.length && !constraints.childAges.every((age) => text.includes(String(age)))) {
      issues.push("CHILD_AGES_MISSING");
    }
  }
  if (resolved.requestProfile?.customs) {
    const customsDestination = String(resolved.travelRoles?.destination || resolved.destination || "").trim();
    if (customsDestination && !text.toLowerCase().includes(customsDestination.toLowerCase())) {
      issues.push("CUSTOMS_DESTINATION_MISSING");
    }
    if (!/\b(official|customs|authority|airline|iata|border)\b/i.test(text)) {
      issues.push("CUSTOMS_SOURCE_MISSING");
    }
  }
  const requestedDays = String(message).match(/\b(\d{1,2})\s*(?:day|days)\b/i)?.[1];
  const durationAcknowledged = requestedDays && new RegExp(
    `(?:\\bday\\s*${requestedDays}\\b|\\b${requestedDays}[-\\s]?days?\\b)`,
    "i",
  ).test(text);
  if (requestedDays && Number(requestedDays) > 1 && !durationAcknowledged) {
    issues.push("TRIP_DURATION_MISSING");
  }

  return {
    passed: issues.length === 0,
    score: Math.max(0, 1 - issues.length * 0.2),
    issueCodes: issues,
    messageCharacters: String(message || "").length,
  };
}

export function qualityGateNode(state) {
  return tracedNode("atlas-agent-quality-gate", state, async () => ({
    quality: assessResponseQuality({
      answer: state.answer,
      resolved: state.resolved,
      memory: state.memory,
      message: state.message,
      responsePlan: state.responsePlan,
      evidence: state.evidence,
    }),
  }));
}

export function routeAfterQualityGate(state) {
  return state.quality?.passed ? "finalize" : "repair";
}

export function repairResponseNode(state) {
  return tracedNode("atlas-agent-repair", state, async () => {
    if (state.quality?.passed) return {};
    const runtime = getAgentRuntime();
    const repaired = await runtime.repairResponse({
      answer: state.answer,
      quality: state.quality,
      message: state.message,
      resolved: state.resolved,
      retrievedDocs: state.retrievedDocs,
      toolResults: state.successfulToolResults,
      documentFocused: state.documentFocused,
    });
    const repairedAnswer = repaired?.answer || state.answer;
    return {
      answer: repairedAnswer,
      verificationResult: repaired?.verificationResult || state.verificationResult,
      quality: assessResponseQuality({
        answer: repairedAnswer,
        resolved: state.resolved,
        memory: state.memory,
        message: state.message,
        responsePlan: state.responsePlan,
        evidence: state.evidence,
      }),
      repairCount: state.repairCount + 1,
    };
  });
}

export function finalizeAuthoritativeNode(state) {
  return {
    result: {
      schemaVersion: 2,
      graphVersion: state.graphVersion || (state.supervisor ? "travel-supervisor-v3" : "travel-orchestrator-v2"),
      mode: "authoritative",
      resolved: state.resolved,
      planner: state.planner,
      retrievedDocs: state.retrievedDocs,
      toolResults: state.toolResults,
      successfulToolResults: state.successfulToolResults,
      answer: state.answer,
      verificationResult: state.verificationResult,
      quality: state.quality,
      repairCount: state.repairCount,
      guardrail: state.guardrail,
      supervisor: state.supervisor,
      specialistResults: state.specialistResults,
      evidence: state.evidence,
      responsePlan: state.responsePlan,
    },
  };
}

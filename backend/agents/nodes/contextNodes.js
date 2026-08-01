import { contextService } from "../../services/contextService.js";
import { travelPlannerService } from "../../services/travelPlannerService.js";

const LOCATION_REQUIRED_INTENTS = new Set([
  "accommodation_search",
  "activity_recommendations",
  "destination_planning",
  "dining_recommendations",
  "route_planning",
  "safety_inquiry",
  "weather_inquiry",
]);

function normalizedSet(values = []) {
  return new Set(values.map((value) => contextService.normalize(value)).filter(Boolean));
}

export function resolveContextNode(state) {
  const deterministic = contextService.resolveContext(
    state.message,
    state.memory,
    state.previousMessages,
  );
  return {
    resolved: travelPlannerService.applyTravelPlan(deterministic, state.planner),
  };
}

export function assessContextNode(state) {
  const resolved = state.resolved || {};
  const explicitLocations = contextService.extractLocations(state.message);
  const explicitSet = normalizedSet(explicitLocations);
  const resolvedSet = normalizedSet(resolved.locations || []);
  const previousDestination = contextService.normalize(state.memory?.destination || "");
  const resolvedDestination = contextService.normalize(resolved.destination || "");
  const contextSwitch = Boolean(
    explicitLocations.length
      && previousDestination
      && !explicitSet.has(previousDestination),
  );
  const warningCodes = [];

  if (contextSwitch && explicitLocations.length && !explicitSet.has(resolvedDestination)) {
    warningCodes.push("CONTEXT_SWITCH_DESTINATION_MISMATCH");
  }
  if (explicitSet.size > 1 && [...explicitSet].some((location) => !resolvedSet.has(location))) {
    warningCodes.push("MULTI_DESTINATION_LOSS");
  }
  if (LOCATION_REQUIRED_INTENTS.has(resolved.intent?.type) && !resolvedDestination) {
    warningCodes.push("DESTINATION_MISSING");
  }
  if (
    contextSwitch
    && previousDestination
    && String(resolved.enrichedUserMessage || "").toLowerCase().includes(previousDestination)
  ) {
    warningCodes.push("STALE_DESTINATION_IN_ENRICHED_CONTEXT");
  }

  const confidence = warningCodes.length
    ? Math.max(0.2, Number(resolved.intent?.confidence || 0.5) - warningCodes.length * 0.2)
    : Number(resolved.intent?.confidence || 0.5);

  return {
    assessment: {
      contextSwitch,
      explicitLocationCount: explicitSet.size,
      resolvedLocationCount: resolvedSet.size,
      destinationChanged: Boolean(previousDestination && resolvedDestination && previousDestination !== resolvedDestination),
      confidence: Math.max(0, Math.min(1, confidence)),
      warningCodes,
    },
  };
}

export function finalizeShadowNode(state) {
  return {
    result: {
      schemaVersion: state.schemaVersion,
      graphVersion: "context-shadow-v1",
      plannerApplied: Boolean(state.planner),
      intent: state.resolved?.intent?.type || "unknown",
      locationScope: state.resolved?.locationScope || "unknown",
      contextSwitch: Boolean(state.assessment?.contextSwitch),
      destinationChanged: Boolean(state.assessment?.destinationChanged),
      explicitLocationCount: Number(state.assessment?.explicitLocationCount || 0),
      resolvedLocationCount: Number(state.assessment?.resolvedLocationCount || 0),
      confidence: Number(state.assessment?.confidence || 0),
      warningCodes: state.assessment?.warningCodes || [],
    },
  };
}

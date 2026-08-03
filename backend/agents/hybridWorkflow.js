const LOCATION_REQUIRED_INTENTS = new Set([
  "accommodation_search",
  "activity_recommendations",
  "destination_planning",
  "dining_recommendations",
  "route_planning",
  "safety_inquiry",
  "weather_inquiry",
]);

const INTENT_SPECIALISTS = Object.freeze({
  accommodation_search: ["stays"],
  activity_recommendations: ["experiences"],
  cultural_inquiry: ["culture"],
  dining_recommendations: ["dining"],
  document_chat: ["documents"],
  route_planning: ["mobility"],
  safety_inquiry: ["safety"],
  travel_logistics: ["logistics"],
  weather_inquiry: ["weather"],
});

const TOOL_SPECIALISTS = Object.freeze({
  comprehensive_weather_analysis: "weather",
  comprehensive_safety_intelligence: "safety",
  cultural_and_travel_insights: "culture",
  intelligent_restaurant_discovery: "dining",
  local_experiences_and_attractions: "experiences",
  route_and_transport_planner: "mobility",
  smart_accommodation_finder: "stays",
});

const SECTION_PLANS = Object.freeze({
  accommodation_search: ["Best matches", "Price and availability", "Area trade-offs", "Before booking"],
  activity_recommendations: ["Best matches", "Why they fit", "Practical details"],
  cultural_inquiry: ["Local context", "How to visit respectfully", "Practical notes"],
  dining_recommendations: ["Best matches", "What each suits", "Practical dining notes"],
  document_chat: ["Answer", "Supporting document details", "What remains unclear"],
  route_planning: ["Recommended route", "Alternatives", "Practical travel notes"],
  safety_inquiry: ["Current assessment", "Main concerns", "Official checks"],
  travel_logistics: ["What to do", "Documents and timing", "Official checks"],
  weather_inquiry: ["Forecast", "What it means for the plan", "Practical preparation"],
});

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function hasRouteEndpoints(resolved = {}) {
  const route = resolved.routeRequest || resolved.journeyRequest || resolved.memory?.route;
  return Boolean(route?.origin && route?.destination);
}

function isPromptExfiltrationAttempt(message = "") {
  return /\b(?:reveal|show|print|expose|return|dump)\b[\s\S]{0,80}\b(?:system prompt|developer message|api keys?|secret|environment variables?|credentials?)\b/i.test(message);
}

function highStakesSignals(message = "", resolved = {}) {
  const text = normalize(message);
  const customs = Boolean(resolved.requestProfile?.customs)
    || /\b(customs?|declare|prohibited|restricted item|border control|duty[- ]?free)\b/.test(text);
  const entry = /\b(visa|entry requirement|passport validity|residence permit|immigration)\b/.test(text);
  const health = /\b(vaccine|vaccination|medicine|medication|medical|health requirement|prescription)\b/.test(text);
  const safety = resolved.intent?.type === "safety_inquiry"
    || /\b(safe|safety|war|conflict|terror|unrest|advisory|evacuation)\b/.test(text);
  return { customs, entry, health, safety };
}

export function evaluateTravelGuardrails({ message = "", resolved = {}, documentFocused = false } = {}) {
  const reasonCodes = [];
  const intent = documentFocused ? "document_chat" : resolved.intent?.type || "destination_planning";
  const destination = String(resolved.destination || resolved.locations?.[0] || "").trim();
  const highStakes = highStakesSignals(message, resolved);

  if (isPromptExfiltrationAttempt(message)) {
    return {
      status: "block",
      intent,
      reasonCodes: ["SECRET_OR_PROMPT_EXFILTRATION"],
      requiresOfficialSources: false,
      highStakes,
      userMessage: "ATLAS cannot reveal private instructions, credentials, or system configuration. I can still help with a travel-planning question.",
    };
  }

  if (!documentFocused && LOCATION_REQUIRED_INTENTS.has(intent) && !destination) {
    reasonCodes.push("DESTINATION_REQUIRED");
  }
  if (intent === "route_planning" && !hasRouteEndpoints(resolved)) {
    reasonCodes.push("ROUTE_ENDPOINTS_REQUIRED");
  }

  const directBookingRequested = /\b(?:book|reserve|pay for|purchase)\b[\s\S]{0,50}\b(?:hotel|room|stay|flight|ticket)\b/i.test(message);
  const paymentDataOffered = /\b(?:card number|card details|credit card|debit card|cvv|cvc|payment details)\b/i.test(message);
  if (directBookingRequested) reasonCodes.push("COMPARISON_ONLY");
  if (paymentDataOffered) reasonCodes.push("PAYMENT_DATA_NOT_ACCEPTED");

  const blockingClarification = reasonCodes.includes("DESTINATION_REQUIRED")
    || reasonCodes.includes("ROUTE_ENDPOINTS_REQUIRED")
    || reasonCodes.includes("PAYMENT_DATA_NOT_ACCEPTED");

  return {
    status: blockingClarification ? "clarify" : "allow",
    intent,
    reasonCodes,
    requiresOfficialSources: Object.values(highStakes).some(Boolean),
    highStakes,
    userMessage: reasonCodes.includes("ROUTE_ENDPOINTS_REQUIRED")
      ? "Tell me both the starting point and destination. Add the travel date or departure time if timing matters."
      : reasonCodes.includes("DESTINATION_REQUIRED")
      ? "Which destination should I plan for? A city, region, country, or named place is enough to begin."
      : reasonCodes.includes("PAYMENT_DATA_NOT_ACCEPTED")
      ? "Do not send payment-card details. ATLAS can compare travel options, but it does not take payments or complete bookings."
      : "",
  };
}

function destinationPlanningSpecialists(message = "", resolved = {}) {
  const text = normalize(message);
  const isFollowUp = Boolean(resolved.intent?.isFollowUp);
  const broadPlan = /\b(plan|visit|trip|travel|weekend|holiday|vacation|itinerary|explore)\b/.test(text);
  const constraints = resolved.requestProfile?.constraints || {};
  const budgetOnlyStay = /\bstay\s+(?:under|below|within)\s*(?:[€$£¥]|eur\b|usd\b|gbp\b|jpy\b|\d)/.test(text);
  const specialists = ["experiences"];

  if ((!isFollowUp && broadPlan) || constraints.dietary?.length || /\b(food|eat|restaurant|cuisine|dining|breakfast|lunch|dinner|vegetarian|vegan|halal|kosher|gluten[- ]?free)\b/.test(text)) specialists.push("dining");
  if ((!isFollowUp && broadPlan) || /\b(hotel|hostel|accommodation|base area|where to base)\b/.test(text) || (!budgetOnlyStay && /\bstay\b/.test(text))) specialists.push("stays");
  if (resolved.dateContext?.iso || /\b(weather|forecast|tomorrow|weekend|next week|season|rain|snow|temperature)\b/.test(text)) specialists.push("weather");
  if ((!isFollowUp && broadPlan) || /\b(safe|safety|advisory|risk|conflict|unrest)\b/.test(text)) specialists.push("safety");
  if ((!isFollowUp && (resolved.locationScope === "country" || broadPlan)) || /\b(culture|custom|etiquette|history|people|language)\b/.test(text)) specialists.push("culture");
  if (constraints.accessible || constraints.minimalWalking || constraints.minimalTransfers || constraints.noCar || /\b(route|transport|train|bus|drive|walk|transit|getting around)\b/.test(text)) specialists.push("mobility");
  return unique(specialists);
}

function responseMode(intent = "", message = "", resolved = {}) {
  if (intent === "route_planning") return "route";
  if (intent === "accommodation_search") return "comparison";
  if (intent === "safety_inquiry" || resolved.requestProfile?.customs) return "advisory";
  if (intent === "document_chat") return "document_answer";
  if (intent === "destination_planning" && /\b(itinerary|day[- ]?by[- ]?day|\d+\s*days?|one day|two days|three days)\b/i.test(message)) return "itinerary";
  if (["activity_recommendations", "dining_recommendations"].includes(intent)) return "shortlist";
  return "direct";
}

export function createSupervisorDecision({ message = "", resolved = {}, documentFocused = false, guardrail = {} } = {}) {
  const intent = documentFocused ? "document_chat" : resolved.intent?.type || guardrail.intent || "destination_planning";
  const text = normalize(message);
  const requested = intent === "destination_planning"
    ? destinationPlanningSpecialists(message, resolved)
    : [...(INTENT_SPECIALISTS[intent] || ["experiences"])]
  if (documentFocused) requested.splice(0, requested.length, "documents");
  const timeSensitiveOutdoorRequest = ["activity_recommendations", "destination_planning"].includes(intent)
    && (/\b(tomorrow|today|tonight|weekend|next week|weather|rain|snow|outdoor|hike|hiking|beach|ski|tennis|cycling|walking)\b/.test(text) || Boolean(resolved.dateContext?.iso));
  if (timeSensitiveOutdoorRequest) requested.push("weather");
  if (intent !== "route_planning" && /\b(route|transport|train|bus|drive|transit|getting around|between)\b/.test(text)) requested.push("mobility");
  if (guardrail.requiresOfficialSources && !requested.includes("safety") && intent !== "document_chat") requested.push("safety");

  const maxSpecialists = Math.max(1, Number(process.env.ATLAS_AGENT_MAX_SPECIALISTS || 6));
  const specialists = unique(requested).slice(0, maxSpecialists);
  const explicitLocations = unique(resolved.explicitLocations || resolved.locations || []);

  return {
    version: 1,
    intent,
    requestClass: documentFocused
      ? "document"
      : guardrail.requiresOfficialSources
      ? "high_stakes"
      : explicitLocations.length > 1
      ? "multi_destination"
      : specialists.length > 1
      ? "multi_specialist"
      : "focused",
    specialists,
    responseMode: responseMode(intent, message, resolved),
    parallelizable: specialists.length > 1 && intent !== "route_planning",
    requiresOfficialSources: Boolean(guardrail.requiresOfficialSources),
    contextBoundary: resolved.intent?.isFollowUp ? "continuation" : "new_or_explicit",
    destinationCount: explicitLocations.length || (resolved.destination ? 1 : 0),
  };
}

export function createSpecialistPlan({ supervisor = {}, toolsToUse = [] } = {}) {
  const allowed = new Set(supervisor.specialists || []);
  const groups = new Map();

  for (const tool of unique(toolsToUse)) {
    const specialist = TOOL_SPECIALISTS[tool] || "general";
    if (allowed.size && !allowed.has(specialist) && specialist !== "general") continue;
    if (!groups.has(specialist)) groups.set(specialist, []);
    groups.get(specialist).push(tool);
  }

  if ((supervisor.specialists || []).includes("documents") && !groups.has("documents")) {
    groups.set("documents", []);
  }

  return [...groups.entries()].map(([specialist, tools]) => ({
    specialist,
    tools,
    required: supervisor.specialists?.[0] === specialist || supervisor.requiresOfficialSources && specialist === "safety",
  }));
}

function resultHasUsefulData(result = {}) {
  if (!result || typeof result !== "object") return false;
  if (result.current_weather || result.hourly_forecast?.length || result.routes?.length) return true;
  return ["recommendations", "restaurants", "properties", "places", "attractions", "hotels", "articles"]
    .some((key) => Array.isArray(result[key]) && result[key].length);
}

export function reconcileSpecialistEvidence({ specialistPlan = [], specialistResults = [], toolResults = [], retrievedDocs = [] } = {}) {
  const byTool = new Map(toolResults.map((item) => [item.tool, item]));
  const sources = [];

  for (const group of specialistPlan) {
    for (const tool of group.tools) {
      const item = byTool.get(tool) || {};
      const quality = item.result?.data_quality || {};
      sources.push({
        specialist: group.specialist,
        tool,
        status: item.status || "missing",
        verified: quality.verified === true || quality.status === "verified",
        qualityStatus: quality.status || (item.status === "success" ? "returned" : "unavailable"),
        useful: resultHasUsefulData(item.result),
        attributionRequired: /google|places/i.test(String(quality.source || item.result?.source || "")),
      });
    }
  }

  if (retrievedDocs.length) {
    sources.push({
      specialist: "documents",
      tool: "document_retrieval",
      status: "success",
      verified: true,
      qualityStatus: "user_document",
      useful: true,
      attributionRequired: false,
    });
  }

  const requiredSpecialists = specialistPlan.filter((item) => item.required).map((item) => item.specialist);
  const completedSpecialists = unique([
    ...specialistResults.filter((item) => item.status !== "failed").map((item) => item.specialist),
    ...sources.filter((item) => item.status === "success").map((item) => item.specialist),
  ]);
  const missingRequired = requiredSpecialists.filter((specialist) => !completedSpecialists.includes(specialist));

  return {
    version: 1,
    sources,
    coverage: {
      requestedSpecialists: specialistPlan.length,
      completedSpecialists: completedSpecialists.length,
      verifiedSources: sources.filter((item) => item.verified).length,
      usefulSources: sources.filter((item) => item.useful).length,
      failedSources: sources.filter((item) => item.status === "failed" || item.status === "missing").length,
    },
    missingRequired,
    canCompose: missingRequired.length === 0 || sources.some((item) => item.useful),
    warnings: unique([
      ...(missingRequired.length ? ["REQUIRED_SPECIALIST_UNAVAILABLE"] : []),
      ...(sources.length && !sources.some((item) => item.useful) ? ["NO_USEFUL_LIVE_EVIDENCE"] : []),
    ]),
  };
}

export function createResponsePlan({ message = "", resolved = {}, supervisor = {}, evidence = {} } = {}) {
  const intent = supervisor.intent || resolved.intent?.type || "destination_planning";
  const destinations = unique(resolved.explicitLocations || resolved.locations || [resolved.destination]);
  const sections = SECTION_PLANS[intent]
    || (supervisor.responseMode === "itinerary"
      ? ["Plan requirements", "Day-by-day plan", "Transport logic", "Checks before leaving"]
      : ["Best approach", "Recommended options", "Practical details"]);
  const constraints = resolved.requestProfile?.constraints || {};
  const mustCover = unique([
    ...destinations.map((destination) => `destination:${destination}`),
    constraints.accessible ? "accessibility" : "",
    constraints.minimalWalking ? "minimal_walking" : "",
    constraints.minimalTransfers ? "minimal_transfers" : "",
    constraints.maxBudget ? "budget" : "",
    constraints.dietary?.length ? "dietary_needs" : "",
    constraints.checkIn ? "dates" : "",
    supervisor.requiresOfficialSources ? "official_source_caution" : "",
  ]);

  return {
    version: 1,
    mode: supervisor.responseMode || "direct",
    intent,
    destinations,
    sections: sections.slice(0, 5),
    mustCover,
    maxSections: supervisor.responseMode === "itinerary" ? 7 : 5,
    maxBulletsPerSection: 6,
    targetWords: supervisor.responseMode === "itinerary" ? 650 : supervisor.requestClass === "focused" ? 320 : 500,
    omitRepeatedSafety: Boolean(resolved.intent?.isFollowUp && !supervisor.specialists?.includes("safety")),
    evidenceWarnings: evidence.warnings || [],
    rules: [
      "Answer the current request in the first paragraph.",
      "Use only request-scoped evidence for live facts and named places.",
      "Do not repeat previously covered sections unless the context changed.",
      "Do not mention internal tools, agents, APIs, or provider failures.",
      "Keep required attribution visible.",
    ],
    requestCharacters: String(message || "").length,
  };
}

export function renderGuardrailResponse(guardrail = {}) {
  const title = guardrail.status === "block" ? "I can’t help with that request" : "One detail before I continue";
  const guidance = guardrail.userMessage || "Please add the missing travel details so ATLAS can answer accurately.";
  const nextStep = guardrail.reasonCodes?.includes("PAYMENT_DATA_NOT_ACCEPTED")
    ? "Ask ATLAS to compare properties for your dates and budget without sharing financial information."
    : guardrail.reasonCodes?.includes("ROUTE_ENDPOINTS_REQUIRED")
    ? "Add the missing endpoint and ATLAS can compare the route options."
    : guardrail.reasonCodes?.includes("DESTINATION_REQUIRED")
    ? "Share a city, region, country, or named place to continue."
    : "Ask another travel-planning question whenever you are ready.";
  return `## ${title}\n\n${guidance}\n\n${nextStep}`;
}

export function responsePlanPrompt(responsePlan = {}) {
  if (!responsePlan?.version) return "";
  const destinations = responsePlan.destinations?.join(", ") || "the current destination";
  const sections = responsePlan.sections?.join("; ") || "only sections needed for the request";
  const mustCover = responsePlan.mustCover?.join(", ") || "the user's explicit request";
  return `ATLAS response contract:\n- Mode: ${responsePlan.mode}\n- Current destinations: ${destinations}\n- Suggested information order: ${sections}\n- Must cover: ${mustCover}\n- Maximum sections: ${responsePlan.maxSections}\n- Target length: no more than about ${responsePlan.targetWords} words unless essential facts require more.\n- ${responsePlan.rules.join("\n- ")}`;
}

export const hybridWorkflowTestUtils = {
  INTENT_SPECIALISTS,
  TOOL_SPECIALISTS,
  destinationPlanningSpecialists,
  highStakesSignals,
  isPromptExfiltrationAttempt,
};

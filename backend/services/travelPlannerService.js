import axios from "axios";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";
import { contextService } from "./contextService.js";
import { logger } from "../utils/logger.js";
import { runWithoutAutomaticTracing } from "../agents/monitoring/atlasTracing.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_PLANNER_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const ALLOWED_INTENTS = new Set([
  "destination_planning",
  "activity_recommendations",
  "weather_inquiry",
  "accommodation_search",
  "dining_recommendations",
  "safety_inquiry",
  "cultural_inquiry",
  "route_planning",
  "travel_logistics",
  "document_chat",
]);

const TravelPlanSchema = z.object({
  intent: z.enum([...ALLOWED_INTENTS]),
  confidence: z.number().min(0).max(1),
  destination: z.string().default(""),
  location_scope: z.enum(["city", "country", "region", "unknown"]).default("unknown"),
  activity: z.string().default(""),
  date_text: z.string().default(""),
  target_date: z.string().default(""),
  route: z.object({
    origin: z.string().default(""),
    destination: z.string().default(""),
    mode: z.string().default("transit"),
  }).nullable().default(null),
  required_tools: z.array(z.string()).max(7).default([]),
  place_search_queries: z.array(z.string()).max(10).default([]),
  map_searches: z.array(z.string()).max(8).default([]),
  answer_style: z.string().default("destination_overview"),
});

function plannerEnabled() {
  return Boolean(process.env.GROQ_API_KEY) && process.env.ATLAS_LLM_PLANNER_ENABLED !== "false";
}

function langChainPlannerEnabled() {
  return process.env.ATLAS_LANGCHAIN_PLANNER_ENABLED === "true";
}

function cleanString(value = "", max = 120) {
  return String(value || "")
    .replace(/[{}<>`$]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanDestination(value = "") {
  return cleanString(value, 120)
    .replace(/\s+\b(?:in|during|around|for)\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|autumn|fall|winter|this\s+weekend|next\s+weekend|next\s+week|this\s+week)\b.*$/i, "")
    .replace(/\s+\b(?:and|or)\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|autumn|fall|winter)\b.*$/i, "")
    .replace(/\b(?:today|tomorrow|tonight|this\s+weekend|next\s+weekend|next\s+week|this\s+week)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeArray(value, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item, 90)).filter(Boolean).slice(0, limit);
}

function sanitizePlan(plan = {}) {
  const intent = ALLOWED_INTENTS.has(plan.intent) ? plan.intent : "";
  const confidence = Number(plan.confidence || 0);
  const destination = cleanDestination(plan.destination || "");
  const activity = cleanString(plan.activity || "", 40).toLowerCase();
  const dateText = cleanString(plan.date_text || plan.dateText || "", 60);
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(plan.target_date || "")) ? String(plan.target_date) : "";

  return {
    intent,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    destination,
    location_scope: ["city", "country", "region", "unknown"].includes(plan.location_scope) ? plan.location_scope : "unknown",
    activity,
    date_text: dateText,
    target_date: targetDate,
    route: plan.route && typeof plan.route === "object" ? {
      origin: cleanString(plan.route.origin || ""),
      destination: cleanString(plan.route.destination || ""),
      mode: cleanString(plan.route.mode || "transit", 30),
    } : null,
    required_tools: safeArray(plan.required_tools, 7),
    place_search_queries: safeArray(plan.place_search_queries, 10),
    map_searches: safeArray(plan.map_searches, 8),
    answer_style: cleanString(plan.answer_style || "", 80),
  };
}

export async function createTravelPlan({ message = "", memory = {}, previousMessages = [], signal } = {}) {
  if (!plannerEnabled()) return null;

  const history = previousMessages.slice(-6).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 420) }));
  const today = new Date().toISOString().slice(0, 10);

  const system = `You are ATLAS's travel intent planner. Return only compact JSON. Your job is not to answer the user. Extract intent, location, activity, date, budget, place category and tool needs for a travel assistant. Resolve relative dates using today's UTC date ${today}. Never invent venue names. Treat exclusions and negative preferences such as "do not", "without", "avoid" and "dislike" as constraints, never as requested tools or interests. Clock ranges such as "from 10:30 to 18:00" are itinerary times, not route endpoints. A pool, gym or spa mentioned in a hotel request is an amenity and must not replace accommodation_search. Multi-day trips, day plans and requests for several bases remain destination_planning even when they mention food, hotels or activities. Use place_search_queries for Google Places/Maps searches whenever the user asks for venues, sports, attractions, restaurants, cafes, bars, nightlife, hotels, motels, lodges, hostels, routes or local activities. Safety-sensitive travel plans should request news plus official-advisory style caution, but never mark a place as 100% safe just because news is quiet.`;
  const user = JSON.stringify({
    message,
    memory: {
      destination: memory.destination || "",
      locations: memory.locations || [],
      interests: memory.interests || [],
      travelDates: memory.travelDates || [],
      pendingActivitySearch: memory.pendingActivitySearch || null,
      lastIntent: memory.lastIntent || "",
    },
    recentConversation: history,
    requiredJsonShape: {
      intent: "destination_planning | activity_recommendations | weather_inquiry | accommodation_search | dining_recommendations | safety_inquiry | cultural_inquiry | route_planning | travel_logistics | document_chat",
      confidence: "0..1",
      destination: "city/country/region if present or strongly implied",
      location_scope: "city | country | region | unknown",
      activity: "specific sport/activity such as tennis, badminton, museum, restaurant, hotel, hiking; empty if broad destination planning",
      date_text: "raw user date phrase such as this Saturday, tomorrow, this weekend",
      target_date: "YYYY-MM-DD when resolvable, otherwise empty",
      route: { origin: "", destination: "", mode: "train|transit|driving|walking|bicycling" },
      required_tools: ["weather", "places", "news", "culture", "route", "hotels", "restaurants", "nightlife"],
      place_search_queries: ["short query strings for place search, requested activity first"],
      map_searches: ["short Google Maps searches, requested intent first"],
      answer_style: "activity_first | destination_overview | route_first | weather_first | hotel_first | food_first | nightlife_first | safety_first | itinerary_first | document_first"
    }
  });

  try {
    if (langChainPlannerEnabled()) {
      const model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: MODEL,
        temperature: 0,
        maxTokens: 650,
        maxRetries: 0,
        timeout: 7000,
      });
      const structuredPlanner = model.withStructuredOutput(
        TravelPlanSchema,
        { name: "atlas_travel_plan", method: "functionCalling" },
      );
      const plan = await runWithoutAutomaticTracing(() => structuredPlanner.invoke(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        {
          signal,
          callbacks: [],
          tags: ["atlas", "planner", "langchain"],
          metadata: { operation: "travel_planning", graphVersion: "travel-orchestrator-v2" },
        },
      ));
      return sanitizePlan(plan);
    }

    const response = await axios.post(
      GROQ_URL,
      {
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
        max_tokens: 650,
        response_format: { type: "json_object" },
      },
      {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        timeout: 7000,
        signal,
        validateStatus: (status) => status < 500,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || "";
    if (!content || response.status >= 400) return null;
    return sanitizePlan(JSON.parse(content));
  } catch (error) {
    if (signal?.aborted || error?.code === "ERR_CANCELED") throw error;
    logger.debug("LLM travel planner fallback", { reason: error.message });
    return null;
  }
}

export function applyTravelPlan(resolved = {}, plan = null) {
  if (!plan || plan.confidence < 0.62) return resolved;
  const contextSwitchPrompt = /\b(instead|rather|change|switch|what about|how about)\b/i.test(String(resolved.enrichedUserMessage || ""));
  const keepLocationOnlyDestinationIntent = resolved.intent?.locationOnlyFollowUp
    && resolved.intent?.type === "destination_planning"
    && !contextSwitchPrompt;
  const keepRefinementDestinationIntent = resolved.intent?.type === "destination_planning"
    && Boolean(resolved.destination || resolved.memory?.destination)
    && /\b(budget|cheap|affordable|low[-\s]?cost|vegetarian|vegan|halal|kosher|gluten[-\s]?free|dietary|no meat|plant[-\s]?based)\b/i.test(String(resolved.enrichedUserMessage || ""));
  const keepItineraryDestinationIntent = resolved.intent?.type === "destination_planning"
    && Boolean(resolved.destination || resolved.memory?.destination)
    && /\b(plan|itinerary|one[-\s]?day|1[-\s]?day|day plan|whole day|same requirements|morning|lunch|afternoon|evening|start after|replace|focus (?:on|around)|stay base|base area)\b/i.test(String(resolved.enrichedUserMessage || ""));
  const keepHighConfidenceDeterministicIntent = Number(resolved.intent?.confidence || 0) >= 0.9
    && [
      "route_planning",
      "weather_inquiry",
      "accommodation_search",
      "dining_recommendations",
      "safety_inquiry",
      "activity_recommendations",
      "travel_logistics",
    ].includes(resolved.intent?.type);
  const keepDestinationIntent = keepLocationOnlyDestinationIntent
    || keepRefinementDestinationIntent
    || keepItineraryDestinationIntent
    || keepHighConfidenceDeterministicIntent;
  const keepExplicitDestination = Boolean(resolved.destination && resolved.locations?.length)
    && !contextSwitchPrompt;

  const next = {
    ...resolved,
    planner: plan,
    intent: { ...resolved.intent },
    memory: { ...(resolved.memory || {}) },
  };

  if (plan.intent && ALLOWED_INTENTS.has(plan.intent) && plan.intent !== "document_chat" && !keepDestinationIntent) {
    next.intent = { ...next.intent, type: plan.intent, plannerConfidence: plan.confidence };
  }

  const cleanedPlanDestination = plan.destination ? cleanDestination(plan.destination) : "";
  const plannerConfirmsExplicitDestination = cleanedPlanDestination
    && contextService.normalize(cleanedPlanDestination) === contextService.normalize(resolved.destination || "");
  if (
    plan.destination
    && !keepLocationOnlyDestinationIntent
    && (!keepExplicitDestination || plannerConfirmsExplicitDestination)
  ) {
    const cleanedDestination = cleanedPlanDestination;
    next.destination = contextService.canonicalDestination(cleanedDestination || plan.destination);
    next.locationScope = plan.location_scope === "country" ? "country" : plan.location_scope === "region" ? "region" : "city";
    const contextSwitch = contextSwitchPrompt || next.locationScope === "country";
    next.locations = contextSwitch
      ? [next.destination]
      : [next.destination, ...(resolved.locations || []).filter((loc) => contextService.normalize(loc) !== contextService.normalize(next.destination))].slice(0, 3);
    next.memory.destination = next.destination;
    next.memory.locations = [...new Set([next.destination, ...(next.memory.locations || [])])].slice(0, 8);
    next.memory.locationScope = next.locationScope;
  }

  const dateContext = plan.target_date || plan.date_text
    ? { raw: plan.date_text || plan.target_date, label: plan.date_text || plan.target_date, iso: plan.target_date || "", kind: plan.target_date ? "single_day" : "text" }
    : resolved.dateContext;

  if (dateContext) {
    next.dateContext = dateContext;
    next.dates = dateContext.raw ? [dateContext.raw] : resolved.dates || [];
  }

  if (plan.activity && plan.intent === "activity_recommendations" && !keepDestinationIntent) {
    const activity = contextService.extractPrimaryActivity(plan.activity) || plan.activity;
    next.activityRequest = {
      activity,
      activityLabel: contextService.activityDisplayName(activity),
      location: next.destination || resolved.destination || "",
      date: dateContext?.raw || resolved.activityRequest?.date || "",
      targetDate: dateContext?.iso || resolved.activityRequest?.targetDate || "",
    };
    next.memory.pendingActivitySearch = next.activityRequest;
    next.memory.interests = [...new Set([...(next.memory.interests || []), activity])].slice(-12);
  }

  if (plan.route?.origin && plan.route?.destination && plan.intent === "route_planning") {
    const deterministicRoute = resolved.routeRequest || null;
    const route = deterministicRoute?.origin && deterministicRoute?.destination
      ? {
          ...plan.route,
          ...deterministicRoute,
          mode: deterministicRoute.mode || plan.route.mode || "transit",
        }
      : plan.route;
    next.routeRequest = route;
    next.memory.route = route;
  }

  return next;
}

export const travelPlannerService = {
  createTravelPlan,
  applyTravelPlan,
  isEnabled: plannerEnabled,
  isLangChainEnabled: langChainPlannerEnabled,
};

import axios from "axios";
import { contextService } from "./contextService.js";
import { logger } from "../utils/logger.js";

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

function plannerEnabled() {
  return Boolean(process.env.GROQ_API_KEY) && process.env.ATLAS_LLM_PLANNER_ENABLED !== "false";
}

function cleanString(value = "", max = 120) {
  return String(value || "")
    .replace(/[{}<>`$]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeArray(value, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item, 90)).filter(Boolean).slice(0, limit);
}

function sanitizePlan(plan = {}) {
  const intent = ALLOWED_INTENTS.has(plan.intent) ? plan.intent : "";
  const confidence = Number(plan.confidence || 0);
  const destination = cleanString(plan.destination || "");
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

export async function createTravelPlan({ message = "", memory = {}, previousMessages = [] } = {}) {
  if (!plannerEnabled()) return null;

  const history = previousMessages.slice(-6).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 420) }));
  const today = new Date().toISOString().slice(0, 10);

  const system = `You are ATLAS's travel intent planner. Return only compact JSON. Your job is not to answer the user. Extract intent, location, activity, date, budget, place category and tool needs for a travel assistant. Resolve relative dates using today's UTC date ${today}. Never invent venue names. Use place_search_queries for Google Places/Maps searches whenever the user asks for venues, sports, attractions, restaurants, cafes, bars, nightlife, hotels, motels, lodges, hostels, routes or local activities. Safety-sensitive travel plans should request news plus official-advisory style caution, but never mark a place as 100% safe just because news is quiet.`;
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
      route: { origin: "", destination: "", mode: "transit|driving|walking|bicycling" },
      required_tools: ["weather", "places", "news", "culture", "route", "hotels", "restaurants", "nightlife"],
      place_search_queries: ["short query strings for place search, requested activity first"],
      map_searches: ["short Google Maps searches, requested intent first"],
      answer_style: "activity_first | destination_overview | route_first | weather_first | hotel_first | food_first | nightlife_first | safety_first | itinerary_first | document_first"
    }
  });

  try {
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
        validateStatus: (status) => status < 500,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || "";
    if (!content || response.status >= 400) return null;
    return sanitizePlan(JSON.parse(content));
  } catch (error) {
    logger.debug("LLM travel planner fallback", { reason: error.message });
    return null;
  }
}

export function applyTravelPlan(resolved = {}, plan = null) {
  if (!plan || plan.confidence < 0.62) return resolved;

  const next = {
    ...resolved,
    planner: plan,
    intent: { ...resolved.intent },
    memory: { ...(resolved.memory || {}) },
  };

  if (plan.intent && ALLOWED_INTENTS.has(plan.intent) && plan.intent !== "document_chat") {
    next.intent = { ...next.intent, type: plan.intent, plannerConfidence: plan.confidence };
  }

  if (plan.destination) {
    next.destination = contextService.canonicalDestination(plan.destination);
    next.locations = [next.destination, ...(resolved.locations || []).filter((loc) => contextService.normalize(loc) !== contextService.normalize(next.destination))].slice(0, 3);
    next.locationScope = plan.location_scope === "country" ? "country" : plan.location_scope === "region" ? "region" : "city";
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

  if (plan.activity && plan.intent === "activity_recommendations") {
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
    next.routeRequest = plan.route;
    next.memory.route = plan.route;
  }

  return next;
}

export const travelPlannerService = { createTravelPlan, applyTravelPlan };

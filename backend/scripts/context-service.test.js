// Tests for destination extraction and canonical location handling

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import test from "node:test";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const { contextService } = await import("../services/contextService.js");
const { travelPlannerService } = await import("../services/travelPlannerService.js");
const { isPlausibleLocationResult, sanitizeLocationQuery } = await import("../utils/locationUtils.js");

test("does not extract conversational filler as a location", () => {
  assert.deepEqual(
    contextService.extractLocations("suggest me some hotels there"),
    [],
  );

  assert.deepEqual(contextService.extractLocations("yes I want to know"), []);
});

test("keeps real city names with accent variants", () => {
  assert.equal(contextService.canonicalDestination("Riihimaki"), "Riihimäki");

  assert.equal(
    contextService
      .extractLocations("hourly forecast for Riihimaki")[0]
      .toLowerCase(),
    "riihimäki",
  );
});

test("recognizes ISO-backed countries beyond the manual shortlist", () => {
  assert.equal(contextService.isCountryLike("Liechtenstein"), true);
  assert.equal(contextService.isCountryLike("Côte d'Ivoire"), true);
  assert.equal(contextService.isCountryLike("Ivory Coast"), true);
  assert.equal(contextService.isCountryLike("Kosovo"), true);
  assert.equal(contextService.canonicalDestination("USA"), "United States");
  assert.equal(contextService.canonicalDestination("Viet Nam"), "Vietnam");
  assert.equal(contextService.canonicalDestination("Ivory Coast"), "Côte d'Ivoire");
  assert.deepEqual(contextService.extractLocations("I want to visit Liechtenstein next weekend"), ["liechtenstein"]);
});

test("detects route requests with origin and destination", () => {
  const route = contextService.extractRouteRequest("How do I get from Helsinki railway station to Helsinki airport by train?");
  assert.equal(route.origin, "Helsinki railway station");
  assert.equal(route.destination, "Helsinki airport");
  assert.equal(route.mode, "train");

  const resolved = contextService.resolveContext("Route from Kamppi to Helsinki airport", {}, []);
  assert.equal(resolved.intent.type, "route_planning");
  assert.equal(resolved.routeRequest.origin, "Kamppi");
  assert.equal(resolved.routeRequest.destination, "Helsinki airport");
});

test("does not mistake an itinerary time window for a route", () => {
  const resolved = contextService.resolveContext(
    "Plan a wheelchair-accessible rainy day in Kyoto tomorrow from 10:30 to 18:00 for two adults. We are vegetarian and want one temple and one cultural activity.",
    {},
    [],
  );

  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.routeRequest, null);
  assert.equal(resolved.requestProfile.constraints.startTime, "10:30");
  assert.equal(resolved.requestProfile.constraints.endTime, "18:00");
  assert.equal(resolved.requestProfile.constraints.accessible, true);
  assert.deepEqual(resolved.requestProfile.constraints.dietary, ["vegetarian"]);
});

test("day trips keep the departure city as an origin and preserve no-car constraints", () => {
  const resolved = contextService.resolveContext(
    "Plan a relaxed day in Porvoo tomorrow for two adults travelling from Helsinki without a car.",
    {},
    [],
  );

  assert.equal(resolved.intent.type, "destination_planning");
  assert.deepEqual(resolved.locations, ["Porvoo"]);
  assert.equal(resolved.destination, "Porvoo");
  assert.equal(resolved.requestProfile.constraints.dayCount, 1);
  assert.equal(resolved.requestProfile.constraints.noCar, true);
  assert.equal(resolved.requestProfile.constraints.origin, "Helsinki");
  assert.deepEqual(resolved.journeyRequest, {
    origin: "Helsinki",
    destination: "Porvoo",
    mode: "transit",
    departureTime: "",
    dateLabel: "tomorrow",
    targetDate: resolved.dateContext.iso,
  });
});

test("mixed meal and rain-backup refinements remain itinerary updates", () => {
  const first = contextService.resolveContext(
    "Plan a relaxed day in Porvoo tomorrow for two adults travelling from Helsinki without a car.",
    {},
    [],
  );
  const followUp = contextService.resolveContext(
    "Make lunch vegetarian and add an indoor backup if it rains.",
    first.memory,
    [],
  );

  assert.equal(followUp.intent.type, "destination_planning");
  assert.equal(followUp.intent.itineraryContinuation, true);
  assert.equal(followUp.destination, "Porvoo");
  assert.deepEqual(followUp.requestProfile.constraints.dietary, ["vegetarian"]);
  assert.equal(followUp.requestProfile.constraints.rainAlternative, true);
  assert.equal(followUp.requestProfile.constraints.dayCount, 1);
  assert.equal(followUp.requestProfile.constraints.noCar, true);
  assert.equal(followUp.requestProfile.constraints.origin, "Helsinki");
});

test("preserves deterministic route timing when the LLM planner adds route data", () => {
  const resolved = contextService.resolveContext(
    "What is the best way for two adults with large suitcases to travel from JFK Terminal 4 to a hotel near Times Square tonight at 23:30? Compare public transport with a taxi.",
    {},
    [],
  );
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "route_planning",
    confidence: 0.99,
    destination: "Times Square",
    location_scope: "city",
    route: { origin: "JFK", destination: "Times Square", mode: "transit" },
  });

  assert.equal(planned.routeRequest.origin, "JFK Terminal 4");
  assert.equal(planned.routeRequest.destination, "Times Square");
  assert.equal(planned.routeRequest.departureTime, "23:30");
  assert.ok(planned.routeRequest.targetDate);
});

test("detects non-tennis sports as activity requests", () => {
  const resolved = contextService.resolveContext("Where can I play badminton in Helsinki?", {}, []);
  assert.equal(resolved.intent.type, "activity_recommendations");
  assert.ok(resolved.memory.interests.includes("badminton"));
});

test("detects wellness and mindfulness requests as activities, not places", () => {
  const yoga = contextService.resolveContext("Find yoga classes in Pokhara", {}, []);
  assert.equal(yoga.intent.type, "activity_recommendations");
  assert.equal(yoga.destination, "pokhara");
  assert.equal(yoga.activityRequest.activity, "yoga");

  const meditation = contextService.resolveContext("meditation retreats near Kathmandu", {}, []);
  assert.equal(meditation.intent.type, "activity_recommendations");
  assert.equal(meditation.destination, "kathmandu");
  assert.equal(meditation.activityRequest.activity, "meditation");
});

test("treats dated sports requests as activity searches, not weather-only answers", () => {
  const resolved = contextService.resolveContext("I am thinking to go play tennis tomorrow in Riihimäki", {}, []);
  assert.equal(resolved.intent.type, "activity_recommendations");
  assert.equal(resolved.activityRequest.activity, "tennis");
  assert.ok(resolved.memory.interests.includes("tennis"));
  assert.ok(resolved.dates.includes("tomorrow"));
});

test("mixed city planning requests stay destination-scoped instead of activity-only", () => {
  const resolved = contextService.resolveContext(
    "I want to visit Abuja next weekend. Give me a simple one-day plan with parks, food and a good area to stay.",
    {},
    [],
  );
  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.destination, "Abuja");
  assert.equal(resolved.activityRequest, null);
  assert.ok(resolved.memory.interests.includes("food"));
});

test("keeps hotel amenities inside accommodation intent", () => {
  const resolved = contextService.resolveContext(
    "Compare family-friendly hotels in central Paris for 2 adults and two children. We need step-free access and would prefer a pool.",
    {},
    [],
  );

  assert.equal(resolved.intent.type, "accommodation_search");
  assert.equal(resolved.activityRequest, null);
  assert.equal(resolved.memory.interests.includes("swimming"), false);
});

test("keeps multi-day travel plans broad and honors negative preferences", () => {
  const resolved = contextService.resolveContext(
    "I have 10 days in Japan for a first visit. I care about regional food, history and nature, dislike nightlife, and want exactly three bases.",
    {},
    [],
  );

  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.requestProfile.constraints.dayCount, 10);
  assert.equal(resolved.memory.interests.includes("nightlife"), false);
  assert.notEqual(resolved.memory.diningStyle, "nightlife");
});

test("keeps four-day city itineraries as destination planning", () => {
  const resolved = contextService.resolveContext(
    "Plan a four-day Lisbon trip for two adults with architecture, local food, viewpoints and a moderate budget.",
    {},
    [],
  );

  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.requestProfile.constraints.dayCount, 4);
});

test("ranking follow-ups retain activity context without repeating negated weather", () => {
  const memory = {
    destination: "Riihimäki",
    locations: ["Riihimäki"],
    interests: ["tennis", "indoor"],
    lastIntent: "activity_recommendations",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
  };
  const resolved = contextService.resolveContext(
    "Which of those options is most likely indoors? Do not repeat the weather; rank the best two.",
    memory,
    [],
  );

  assert.equal(resolved.intent.type, "activity_recommendations");
  assert.equal(resolved.intent.isFollowUp, true);
  assert.equal(contextService.containsPositiveTerm(resolved.currentUserMessage, "weather"), false);
  assert.equal(resolved.activityRequest.activity, "tennis");
});

test("a half-day follow-up overrides an inherited multi-day duration", () => {
  const memory = {
    destination: "Abu Dhabi",
    locations: ["Abu Dhabi"],
    interests: ["museum"],
    lastIntent: "destination_planning",
    constraints: { dayCount: 3 },
  };
  const resolved = contextService.resolveContext(
    "Actually, just build one calm afternoon there, ending before 19:00, with no more than two stops.",
    memory,
    [],
  );

  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.requestProfile.constraints.dayCount, 1);
  assert.equal(resolved.requestProfile.constraints.endTime, "19:00");
  assert.equal(resolved.requestProfile.constraints.maxStops, 2);
  assert.deepEqual(resolved.requestProfile.constraints.exclusions || [], []);
});

test("budget wording with 'stay under' remains a destination plan instead of accommodation search", () => {
  const resolved = contextService.resolveContext(
    "Now make it an accessible vegetarian afternoon in Tallinn instead. Keep walking minimal and stay under €150.",
    {
      destination: "Riihimäki",
      locations: ["Riihimäki"],
      lastIntent: "activity_recommendations",
      interests: ["tennis"],
      constraints: { startTime: "18:00", indoorAlternative: true },
    },
    [],
  );

  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(contextService.normalize(resolved.destination), "tallinn");
  assert.deepEqual(resolved.explicitLocations.map(contextService.normalize), ["tallinn"]);
  assert.deepEqual(resolved.locations.map(contextService.normalize), ["tallinn"]);
  assert.equal(resolved.requestProfile.constraints.maxBudget, 150);
  assert.equal(resolved.requestProfile.constraints.currency, "EUR");
  assert.equal(resolved.requestProfile.constraints.accessible, true);
  assert.equal(resolved.requestProfile.constraints.minimalWalking, true);
  assert.deepEqual(resolved.requestProfile.constraints.dietary, ["vegetarian"]);
  assert.equal(resolved.requestProfile.constraints.startTime, undefined);
  assert.equal(resolved.activityRequest, null);
});

test("the verb 'split' is not treated as Split, Croatia in multi-city planning", () => {
  const resolved = contextService.resolveContext(
    "Plan 5 days across Kathmandu and Pokhara, split the time fairly. No strenuous trekking.",
    {},
    [],
  );

  assert.deepEqual(resolved.explicitLocations.map(contextService.normalize), ["kathmandu", "pokhara"]);
  assert.equal(resolved.explicitLocations.some((location) => contextService.normalize(location) === "split"), false);
});

test("planning focus phrases are not extracted as extra destinations", () => {
  const resolved = contextService.resolveContext(
    "Plan a calm 3-day visit to Abu Dhabi focused on museums and architecture.",
    { locations: [], interests: [], travelDates: [] },
    [],
  );

  assert.deepEqual(resolved.locations.map(contextService.normalize), ["abu dhabi"]);
  assert.equal(contextService.normalize(resolved.destination), "abu dhabi");
  assert.equal(resolved.memory.interests.includes("museums"), true);
  assert.equal(resolved.memory.interests.includes("architecture"), true);
});

test("itinerary follow-ups clear stale activity searches", () => {
  const memory = {
    destination: "Abuja",
    locations: ["Abuja"],
    interests: ["tennis", "parks", "food"],
    lastIntent: "destination_planning",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
    travelDates: ["next weekend"],
  };
  const resolved = contextService.resolveContext(
    "Make that a one-day plan with morning, lunch, afternoon and stay base.",
    memory,
    [],
  );
  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.destination, "Abuja");
  assert.equal(resolved.activityRequest, null);
  assert.equal(resolved.memory.pendingActivitySearch, undefined);
});

test("planner cannot downgrade itinerary follow-ups to stale activity searches", () => {
  const resolved = contextService.resolveContext(
    "Make that a one-day plan with morning, lunch, afternoon and stay base.",
    {
      destination: "Abuja",
      locations: ["Abuja"],
      interests: ["tennis", "parks", "food"],
      lastIntent: "destination_planning",
      travelDates: ["next weekend"],
    },
    [],
  );
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "activity_recommendations",
    confidence: 0.96,
    destination: "Abuja",
    location_scope: "city",
    activity: "tennis",
  });
  assert.equal(planned.intent.type, "destination_planning");
  assert.equal(planned.activityRequest, null);
  assert.equal(planned.memory.pendingActivitySearch, undefined);
});

test("keeps accepted sports follow-up grounded in previous activity context", () => {
  const memory = {
    destination: "Riihimäki",
    locations: ["Riihimäki"],
    interests: ["tennis"],
    lastIntent: "activity_recommendations",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
  };
  const previousMessages = [
    { role: "assistant", content: "Would you like me to look for tennis courts or sports centres nearby?" },
  ];
  const resolved = contextService.resolveContext("yes please", memory, previousMessages);
  assert.equal(resolved.intent.type, "activity_recommendations");
  assert.equal(resolved.activityRequest.activity, "tennis");
  assert.equal(resolved.destination, "Riihimäki");
});


test("new destination after sports query does not inherit old tennis activity", () => {
  const memory = {
    destination: "Nepal",
    locations: ["Nepal", "Riihimäki"],
    interests: ["tennis"],
    lastIntent: "destination_planning",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
  };

  const resolved = contextService.resolveContext("Kathmandu", memory, []);
  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.destination, "kathmandu");
  assert.equal(resolved.activityRequest, null);
});

test("unknown city-only refinement after country planning is not reinterpreted as sports", () => {
  const memory = {
    destination: "Nepal",
    locations: ["Nepal", "Riihimäki"],
    interests: ["tennis", "sports", "court"],
    lastIntent: "destination_planning",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
    travelDates: ["next weekend"],
  };

  const resolved = contextService.resolveContext("Dharan", memory, []);
  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.intent.locationOnlyFollowUp, true);
  assert.equal(resolved.destination, "Dharan");
  assert.deepEqual(resolved.locations.slice(0, 1), ["Dharan"]);
  assert.equal(resolved.activityRequest, null);
  assert.equal(resolved.memory.pendingActivitySearch, undefined);
  assert.deepEqual(resolved.memory.locations, ["Nepal", "Dharan"]);
  assert.deepEqual(resolved.memory.interests, []);
});

test("city-only refinement after country planning stays destination planning", () => {
  const first = contextService.resolveContext("I want to visit Nepal next weekend", {}, []);
  const second = contextService.resolveContext("Kathmandu and Pokhara", first.memory, []);

  assert.equal(second.intent.type, "destination_planning");
  assert.equal(second.intent.locationOnlyFollowUp, true);
  assert.equal(second.destination, "kathmandu");
  assert.deepEqual(second.locations.slice(0, 2), ["kathmandu", "pokhara"]);
  assert.equal(second.activityRequest, null);
  assert.equal(second.memory.pendingActivitySearch, undefined);
});

test("month names are not extracted as destinations", () => {
  assert.deepEqual(contextService.extractLocations("I want to visit Japan in October"), ["japan"]);
  assert.deepEqual(contextService.extractLocations("Explain Patagonia for hiking in December"), []);
});

test("planner destination cleanup removes date phrases", () => {
  const resolved = contextService.resolveContext("I want to visit Japan in October", {}, []);
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "destination_planning",
    confidence: 0.99,
    destination: "Japan in October",
    location_scope: "country",
  });

  assert.equal(planned.destination, "Japan");
  assert.equal(planned.locations[0], "Japan");
});

test("city-only refinement clears stale sports venue memory", () => {
  const memory = {
    destination: "Nepal",
    locations: ["Nepal", "Riihimäki"],
    interests: ["tennis", "sports", "court", "budget"],
    lastIntent: "destination_planning",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
    travelDates: ["next weekend"],
  };

  const resolved = contextService.resolveContext("Kathmandu and Pokhara", memory, []);
  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.activityRequest, null);
  assert.equal(resolved.memory.pendingActivitySearch, undefined);
  assert.deepEqual(resolved.memory.interests, ["budget"]);
});

test("planner cannot turn a city-only refinement into stale activity search", () => {
  const memory = {
    destination: "Nepal",
    locations: ["Nepal", "Riihimäki"],
    interests: ["tennis", "sports", "court"],
    lastIntent: "destination_planning",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
  };
  const resolved = contextService.resolveContext("Kathmandu and Pokhara", memory, []);
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "activity_recommendations",
    confidence: 0.99,
    destination: "Pokhara",
    location_scope: "city",
    activity: "tennis",
    place_search_queries: ["tennis courts in Pokhara"],
    map_searches: ["tennis courts pokhara"],
  });

  assert.equal(planned.intent.type, "destination_planning");
  assert.equal(planned.destination, "kathmandu");
  assert.deepEqual(planned.locations.slice(0, 2), ["kathmandu", "pokhara"]);
  assert.equal(planned.activityRequest, null);
  assert.equal(planned.memory.pendingActivitySearch, undefined);
});

test("planner cannot turn an unknown city-only refinement into stale activity search", () => {
  const memory = {
    destination: "Nepal",
    locations: ["Nepal", "Riihimäki"],
    interests: ["tennis", "sports", "court"],
    lastIntent: "destination_planning",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
  };
  const resolved = contextService.resolveContext("Dharan", memory, []);
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "activity_recommendations",
    confidence: 0.99,
    destination: "Dharan",
    location_scope: "city",
    activity: "tennis",
    place_search_queries: ["tennis courts in Dharan"],
    map_searches: ["tennis courts dharan"],
  });

  assert.equal(planned.intent.type, "destination_planning");
  assert.equal(planned.destination, "Dharan");
  assert.deepEqual(planned.locations.slice(0, 1), ["Dharan"]);
  assert.equal(planned.activityRequest, null);
  assert.equal(planned.memory.pendingActivitySearch, undefined);
});

test("planner country switch replaces stale city display locations", () => {
  const memory = {
    destination: "kathmandu",
    locations: ["nepal", "kathmandu", "pokhara"],
    lastIntent: "destination_planning",
    travelDates: ["next weekend"],
  };
  const resolved = contextService.resolveContext("What about Iran instead?", memory, []);
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "destination_planning",
    confidence: 0.99,
    destination: "Iran",
    location_scope: "country",
  });

  assert.equal(planned.destination, "Iran");
  assert.deepEqual(planned.locations, ["Iran"]);
  assert.equal(planned.locationScope, "country");
});

test("common Abu Dhabi typo resolves without inheriting stale locations", () => {
  const memory = {
    destination: "United Arab Emirates",
    locationScope: "country",
    locations: ["Iran", "Tehran", "United Arab Emirates"],
    travelDates: ["next weekend"],
    lastIntent: "destination_planning",
  };
  const resolved = contextService.resolveContext("abu dabi", memory, []);
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "destination_planning",
    confidence: 0.99,
    destination: "Abu Dhabi",
    location_scope: "city",
  });

  assert.equal(contextService.canonicalDestination(planned.destination), "Abu Dhabi");
  assert.equal(planned.locationScope, "city");
  assert.equal(contextService.canonicalDestination(planned.locations[0]), "Abu Dhabi");
  assert.deepEqual(planned.memory.locations, ["United Arab Emirates", "abu dhabi"]);
});

test("generic court follow-up can still inherit remembered sport", () => {
  const memory = {
    destination: "Riihimäki",
    locations: ["Riihimäki"],
    interests: ["tennis"],
    lastIntent: "activity_recommendations",
    pendingActivitySearch: { activity: "tennis", activityLabel: "tennis", location: "Riihimäki", date: "tomorrow" },
  };

  const resolved = contextService.resolveContext("show public courts", memory, []);
  assert.equal(resolved.intent.type, "activity_recommendations");
  assert.equal(resolved.activityRequest.activity, "tennis");
  assert.equal(resolved.destination, "Riihimäki");
});

test("resolves weekday date phrases for activity weather targeting", () => {
  const base = new Date(Date.UTC(2026, 5, 17)); // Wed 17 Jun 2026
  const date = contextService.resolveDateContext("I want to play tennis this Saturday", base);
  assert.equal(date.raw.toLowerCase(), "this saturday");
  assert.equal(date.iso, "2026-06-20");

  const resolved = contextService.resolveContext("I am thinking to go out to play tennis this Saturday in Riihimäki", {}, []);
  assert.equal(resolved.intent.type, "activity_recommendations");
  assert.equal(resolved.activityRequest.activity, "tennis");
  assert.ok(resolved.activityRequest.date.toLowerCase().includes("saturday"));
});

test("detects nightlife and bars as dining recommendations", () => {
  const resolved = contextService.resolveContext("Show me good bars and night clubs in Tokyo", {}, []);
  assert.equal(resolved.intent.type, "dining_recommendations");
  assert.equal(resolved.memory.diningStyle, "nightlife");
  assert.equal(resolved.destination.toLowerCase(), "tokyo");
});

test("detects flexible accommodation categories and budget", () => {
  const hostel = contextService.resolveContext("Find cheap hostels in Kathmandu", {}, []);
  assert.equal(hostel.intent.type, "accommodation_search");
  assert.equal(hostel.memory.budget, "budget");
  assert.equal(hostel.memory.stayType, "hostel");

  const luxury = contextService.resolveContext("Find luxury resorts in Dubai", {}, []);
  assert.equal(luxury.intent.type, "accommodation_search");
  assert.equal(luxury.memory.budget, "luxury");
  assert.equal(luxury.memory.stayType, "resort");
});

test("country planning does not mistake timing or interests for destinations", () => {
  const resolved = contextService.resolveContext(
    "I have 8 days in Japan in late October. First visit, moderate budget, vegetarian, interested in history and nature.",
    {},
    [],
  );

  assert.deepEqual(resolved.explicitLocations.map(contextService.canonicalDestination), ["Japan"]);
  assert.equal(resolved.destination.toLowerCase(), "japan");
  assert.equal(resolved.memory.budget, "mid-range");
  assert.deepEqual(resolved.requestProfile.constraints.dietary, ["vegetarian"]);
  assert.equal(resolved.requestProfile.constraints.dayCount, 8);
  assert.ok(resolved.memory.interests.includes("history"));
  assert.ok(resolved.memory.interests.includes("nature"));
});

test("activity requests preserve a between-time window", () => {
  const resolved = contextService.resolveContext(
    "Can I play outdoor tennis in Riihimäki tomorrow between 16:00 and 19:00? I need public courts.",
    {},
    [],
    { clientLocalDate: "2026-08-03" },
  );

  assert.equal(resolved.intent.type, "activity_recommendations");
  assert.equal(resolved.requestProfile.constraints.startTime, "16:00");
  assert.equal(resolved.requestProfile.constraints.endTime, "19:00");
});

test("visa questions separate passport residence from the trip destination", () => {
  const resolved = contextService.resolveContext(
    "I am a Nepalese citizen living in Finland. Do I need a visa for an 8-day tourist trip to Japan?",
    {},
    [],
  );

  assert.equal(resolved.intent.type, "travel_logistics");
  assert.equal(contextService.canonicalDestination(resolved.destination), "Japan");
  assert.deepEqual(resolved.locations.map(contextService.canonicalDestination), ["Japan"]);
  assert.equal(resolved.requestProfile.visa.nationality, "Nepalese");
  assert.equal(resolved.requestProfile.visa.residence, "Finland");
  assert.equal(contextService.canonicalDestination(resolved.memory.destination), "Japan");
});

test("step-free accessibility does not become a free-activity interest", () => {
  const resolved = contextService.resolveContext(
    "Refine that for step-free transport and minimal walking.",
    { destination: "Japan", locations: ["Japan"], interests: ["history", "nature"], lastIntent: "destination_planning", constraints: {} },
    [],
  );

  assert.deepEqual(resolved.memory.interests, ["history", "nature"]);
  assert.equal(resolved.requestProfile.constraints.accessible, true);
});

test("requested result counts are preserved for viewpoints and options", () => {
  const resolved = contextService.resolveContext(
    "Suggest two viewpoints in Valparaíso suitable for someone avoiding steep walking.",
    {},
    [],
  );

  assert.equal(resolved.requestProfile.constraints.maxStops, 2);
  assert.equal(resolved.requestProfile.constraints.minimalWalking, true);
});

test("city-country qualifiers remain one destination instead of separate trip bases", () => {
  const resolved = contextService.resolveContext(
    "Give me exactly two viewpoints in Valparaíso, Chile, with brief history and geography context.",
    {},
    [],
  );

  assert.deepEqual(resolved.explicitLocations, ["Valparaíso"]);
  assert.deepEqual(resolved.locations, ["Valparaíso"]);
  assert.equal(resolved.destination, "Valparaíso");
});

test("geocoder results must match the requested place rather than a similar spelling", () => {
  assert.equal(sanitizeLocationQuery("Valparaíso"), "Valparaíso");
  assert.equal(isPlausibleLocationResult("Valparaíso", {
    city: "Valparaíso",
    country: "Chile",
    formatted_address: "Valparaíso, Chile",
  }), true);
  assert.equal(isPlausibleLocationResult("Valparaíso", {
    city: "Valparai",
    country: "India",
    formatted_address: "Valparai, Tamil Nadu, India",
  }), false);
});

test("follow-up constraints capture a maximum number of hotel changes", () => {
  const resolved = contextService.resolveContext(
    "Avoid changing hotels more than twice and keep walking minimal.",
    { destination: "Japan", locations: ["Japan"], lastIntent: "destination_planning", constraints: {} },
    [],
  );

  assert.equal(resolved.requestProfile.constraints.maxHotelChanges, 2);
  assert.equal(resolved.requestProfile.constraints.minimalWalking, true);
});

test("revision wording keeps a country itinerary follow-up out of hotel-only intent", () => {
  const resolved = contextService.resolveContext(
    "Please revise that answer. Keep the same two bases, minimal walking, and no more than two hotel changes.",
    {
      destination: "Japan",
      locations: ["Japan"],
      lastIntent: "destination_planning",
      lastTopic: "8-day Japan base plan",
      constraints: { dayCount: 8, dietary: ["vegetarian"] },
    },
    [],
  );

  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.requestProfile.itineraryContinuation, true);
  assert.equal(resolved.requestProfile.constraints.dayCount, 8);
  assert.deepEqual(resolved.requestProfile.constraints.dietary, ["vegetarian"]);
});

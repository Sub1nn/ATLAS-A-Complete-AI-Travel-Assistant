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

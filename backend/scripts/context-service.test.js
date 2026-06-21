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

test("detects route requests with origin and destination", () => {
  const route = contextService.extractRouteRequest("How do I get from Helsinki railway station to Helsinki airport by train?");
  assert.equal(route.origin, "Helsinki railway station");
  assert.equal(route.destination, "Helsinki airport");
  assert.equal(route.mode, "transit");

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

test("treats dated sports requests as activity searches, not weather-only answers", () => {
  const resolved = contextService.resolveContext("I am thinking to go play tennis tomorrow in Riihimäki", {}, []);
  assert.equal(resolved.intent.type, "activity_recommendations");
  assert.equal(resolved.activityRequest.activity, "tennis");
  assert.ok(resolved.memory.interests.includes("tennis"));
  assert.ok(resolved.dates.includes("tomorrow"));
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

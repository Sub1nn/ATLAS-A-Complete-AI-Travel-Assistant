import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { verifyResponse } from "../services/responseVerifier.js";
import { cacheKey, cacheStatus, getOrSetCache } from "../services/cacheService.js";
import { hasAllowedSignature } from "../controllers/documentController.js";
import { chatRateLimiter, purgeUserRateLimitState, rateLimiterTestUtils } from "../config/rateLimiter.js";
import mongoose from "mongoose";
import { Conversation, normalizeConversationMemory } from "../models/Conversation.js";
import { chatController, isDocumentFocusedRequest } from "../controllers/chatController.js";
import { User } from "../models/User.js";
import { documentService } from "../services/documentService.js";
import { contextService } from "../services/contextService.js";
import { toolService } from "../services/toolService.js";
import { Session } from "../models/Session.js";
import { ChatRequest } from "../models/ChatRequest.js";
import { DailyUsage } from "../models/DailyUsage.js";
import { Document } from "../models/Document.js";
import { AccountDeletion } from "../models/AccountDeletion.js";
import { StorageUsage } from "../models/StorageUsage.js";
import { OperationLease } from "../models/OperationLease.js";
import { DocumentDeletion } from "../models/DocumentDeletion.js";
import { WorkerHeartbeat } from "../models/WorkerHeartbeat.js";
import { GlobalUsage } from "../models/GlobalUsage.js";
import { sessionService } from "../services/sessionService.js";
import { emailService } from "../services/emailService.js";
import { usageService } from "../services/usageService.js";
import { documentMayHaveRemoteVectors } from "../services/accountDeletionService.js";
import { authSignupSchema, chatRequestSchema, validate } from "../utils/validation.js";

process.env.NODE_ENV = "test";
const execFileAsync = promisify(execFile);

test("Pinecone missing namespaces are treated as an idempotent deletion result", () => {
  assert.equal(vectorStore._test.isMissingNamespaceError({ status: 404 }), true);
  assert.equal(vectorStore._test.isMissingNamespaceError(new Error("request returned HTTP status 404")), true);
  assert.equal(vectorStore._test.isMissingNamespaceError({ status: 503 }), false);
});

test("document extraction runs in a bounded child process", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-extractor-test-"));
  const source = path.join(directory, "sample.txt");
  await fs.writeFile(source, "Safe travel notes for Helsinki");
  try {
    const { stdout } = await execFileAsync(process.execPath, [new URL("./extract-document-child.js", import.meta.url).pathname, source, "text/plain", "sample.txt"], {
      env: { ...process.env, MAX_DOCUMENT_TEXT_CHARS: "1000" },
    });
    assert.equal(stdout, "Safe travel notes for Helsinki");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("response verifier adds caution for unsupported prices and availability", () => {
  const { answer, verification } = verifyResponse({
    answer: "Hotel Example is available for €120 per night and is completely safe.",
    toolResults: [],
    documentMatches: [],
  });

  assert.equal(verification.modified, true);
  assert.match(answer, /Verification note/);
  assert.match(answer, /prices/i);
  assert.doesNotMatch(answer, /€120/);
  assert.doesNotMatch(answer, /is available/i);
  assert.doesNotMatch(answer, /completely safe/i);
});

test("response verifier preserves an explicit user budget while removing invented prices", () => {
  const { answer, verification } = verifyResponse({
    answer: "Keep the total plan within €180. Reject any option above 180 EUR. A ticket should cost €47.",
    toolResults: [],
    documentMatches: [],
    requestConstraints: { maxBudget: 180, currency: "EUR" },
  });
  assert.match(answer, /within €180/);
  assert.match(answer, /above 180 EUR/);
  assert.doesNotMatch(answer, /€47/);
  assert.equal(verification.modified, true);
});

test("response verifier preserves deterministic customs thresholds and declared cash amounts", () => {
  const { answer, verification } = verifyResponse({
    answer: "Declare €12,000 because the official threshold is €10,000 or more.",
    toolResults: [],
    documentMatches: [],
    allowAuthoritativeAmounts: true,
  });
  assert.match(answer, /€12,000/);
  assert.match(answer, /€10,000/);
  assert.equal(verification.modified, false);
});

test("attached documents do not hijack ordinary short travel questions", () => {
  const documentIds = [new mongoose.Types.ObjectId().toString()];
  assert.equal(isDocumentFocusedRequest("What is the weather in Helsinki?", documentIds), false);
  assert.equal(isDocumentFocusedRequest("Find hotels in Tokyo", documentIds), false);
  assert.equal(isDocumentFocusedRequest("Summarize the attached PDF", documentIds), true);
  assert.equal(isDocumentFocusedRequest("What does this document say?", documentIds), true);
});

test("news safety classification separates evidence coverage from ATLAS caution score", () => {
  const coverage = toolService._test.newsCoverageFromArticles([
    { title: "Airport closure after major storm", description: "Travel disruption continues", publishedAt: "2026-06-22T08:00:00Z" },
  ]);
  assert.equal(coverage.news_attention_level, "high");
  assert.equal("score" in coverage, false);
  assert.match(coverage.interpretation, /separate from the ATLAS caution score/i);

  const nepal = toolService._test.calculateSafetyCaution({
    location: "Nepal",
    country: "Nepal",
    articles: [],
    officialAdvisory: null,
    coverage: { news_attention_level: "limited", main_signals: [] },
  });
  const iran = toolService._test.calculateSafetyCaution({
    location: "Iran",
    country: "Iran",
    articles: [{ title: "Travel advisory warns of detention risk and regional conflict", description: "Security situation remains tense" }],
    officialAdvisory: { alert_status: ["The FCDO advises against all travel to Iran"] },
    coverage,
  });

  assert.ok(iran.score > nepal.score + 30);
  assert.match(iran.label, /Red-flag|High caution/);
});

test("destination follow-ups avoid repeating same-country safety sections", () => {
  const safetyResult = {
    tool: "comprehensive_safety_intelligence",
    status: "success",
    result: {
      current_situation: [],
      safety_assessment: {
        caution_score: 48,
        caution_label: "Moderate caution",
        news_attention_level: "elevated",
        news_attention_label: "Elevated-attention recent news coverage",
        coverage_confidence: "medium",
        checked_at: "2026-07-09T12:00:00.000Z",
      },
    },
  };
  const sameCountryResolved = {
    intent: { type: "destination_planning", isFollowUp: true, locationOnlyFollowUp: true },
    destination: "kathmandu",
    locations: ["kathmandu", "pokhara"],
    locationScope: "city",
    memory: { locations: ["nepal", "kathmandu", "pokhara"] },
  };
  const sameCountryAnswer = chatController._test.composeDestinationPipelineAnswer(sameCountryResolved, [safetyResult]);
  assert.doesNotMatch(sameCountryAnswer, /\*\*Safety and current context\*\*/);

  const switchedCountryResolved = {
    intent: { type: "destination_planning", isFollowUp: true, locationOnlyFollowUp: true },
    destination: "paris",
    locations: ["paris"],
    locationScope: "city",
    memory: { locations: ["nepal", "paris"] },
  };
  const switchedAnswer = chatController._test.composeDestinationPipelineAnswer(switchedCountryResolved, [safetyResult]);
  assert.match(switchedAnswer, /\*\*Safety and current context\*\*/);
});

test("country-scope answers do not display stale city memory", () => {
  const safetyResult = {
    tool: "comprehensive_safety_intelligence",
    status: "success",
    result: {
      current_situation: [],
      safety_assessment: {
        caution_score: 95,
        caution_label: "Red-flag / avoid or defer unless essential",
        news_attention_level: "limited",
        news_attention_label: "Limited relevant recent news coverage",
        coverage_confidence: "medium",
        checked_at: "2026-07-09T12:00:00.000Z",
      },
    },
  };
  const resolved = {
    intent: { type: "destination_planning", isFollowUp: true },
    destination: "Iran",
    locations: ["Iran"],
    locationScope: "country",
    memory: { locations: ["Iran", "Nepal", "kathmandu", "pokhara"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [safetyResult]);
  assert.match(answer, /^\*\*Iran\*\*/);
  assert.doesNotMatch(answer.split("\n\n")[0], /Kathmandu|Pokhara/);
});

test("country-scope answers include country-wide map searches", () => {
  const resolved = {
    intent: { type: "destination_planning" },
    destination: "Japan",
    locations: ["Japan"],
    locationScope: "country",
    memory: { locations: ["Japan"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "cultural_and_travel_insights",
      status: "success",
      result: { practical_tips: [] },
    },
  ]);
  const actions = chatController._test.countryMapSearchActions(resolved);
  assert.doesNotMatch(answer, /\*\*Places and map searches\*\*/);
  assert.equal(actions[0].url, "https://www.google.com/maps/search/?api=1&query=top%20attractions%20in%20Japan");
  assert.ok(actions.some((item) => item.name === "Traditional food in Japan" && item.is_search));
});

test("mixed city planning prioritizes requested food, stay and attraction tools", () => {
  const resolved = contextService.resolveContext(
    "I want to visit Abuja next weekend. Give me a simple one-day plan with parks, food and a good area to stay.",
    {},
    [],
  );
  const tools = chatController._test.relevantToolNames(resolved.intent.type, resolved.locations, false, resolved);
  assert.equal(resolved.intent.type, "destination_planning");
  assert.deepEqual(tools.slice(0, 4), [
    "local_experiences_and_attractions",
    "intelligent_restaurant_discovery",
    "smart_accommodation_finder",
    "comprehensive_weather_analysis",
  ]);
  assert.equal(tools.includes("comprehensive_safety_intelligence"), false);
});

test("dietary needs in a new multi-interest trip do not collapse into a follow-up refinement", () => {
  const initialResolved = {
    intent: { type: "destination_planning", isFollowUp: false },
    destination: "Kyoto",
    locations: ["Kyoto"],
    memory: { destination: "Kyoto", locations: ["Kyoto"] },
  };
  const followUpResolved = {
    ...initialResolved,
    intent: { type: "destination_planning", isFollowUp: true },
  };
  const message = "I’m visiting Kyoto for 3 days and care about quiet temples, vegetarian food and minimal backtracking.";

  assert.equal(chatController._test.isBudgetDietRefinement(message, initialResolved), false);
  assert.equal(chatController._test.isBudgetDietRefinement("Make the same trip vegetarian-friendly", followUpResolved), true);
});

test("one-day city planning answers with an actual day flow", () => {
  const resolved = contextService.resolveContext(
    "Plan Abuja for one day next weekend with parks, local food and a good area to stay.",
    {},
    [],
  );
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "local_experiences_and_attractions",
      status: "success",
      result: {
        location: "Abuja, Nigeria",
        recommendations: [
          { name: "Central Park", rating: 4.3, review_count: 1876, open_now: true, address: "Garki, Abuja" },
          { name: "Millennium Park", rating: 4.3, review_count: 5309, open_now: true, address: "Three Arms Zone, Abuja" },
        ],
      },
    },
    {
      tool: "intelligent_restaurant_discovery",
      status: "success",
      result: {
        location: "Abuja, Nigeria",
        restaurants: [
          { name: "Nkoyo", rating: 4.3, review_count: 2219, open_now: true, address: "Central Area, Abuja" },
        ],
      },
    },
    {
      tool: "smart_accommodation_finder",
      status: "success",
      result: {
        location: "Abuja, Nigeria",
        properties: [
          { name: "Abuja Continental Hotel", rating: 4.8, review_count: 10958, address: "Wuse, Abuja" },
        ],
      },
    },
  ]);
  assert.match(answer, /\*\*Simple day flow\*\*/);
  assert.match(answer, /Start: begin with Central Park/);
  assert.match(answer, /Lunch or early dinner: keep the meal close to your route at Nkoyo/);
  assert.match(answer, /Afternoon: add Millennium Park/);
  assert.doesNotMatch(answer, /turn this shortlist into a morning\/afternoon\/evening plan next/);
});

test("a one-day food-led request remains destination planning", () => {
  const resolved = contextService.resolveContext(
    "Plan one relaxed day in Osaka around street food and an easy evening. Keep it concise.",
    {},
    [],
  );
  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(resolved.destination, "osaka");
  assert.deepEqual(resolved.locations.map((location) => location.toLowerCase()), ["osaka"]);
});

test("concise destination answers trim secondary sections", () => {
  const resolved = contextService.resolveContext(
    "Give me a concise Abuja one-day plan with morning park, lunch and stay base.",
    {},
    [],
  );
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_safety_intelligence",
      status: "success",
      result: {
        location: "Abuja",
        country: "Nigeria",
        current_situation: [
          { headline: "Security headline", source: "Example", published: "2026-07-10T00:00:00.000Z", summary: "Security context", url: "https://example.com" },
        ],
        safety_assessment: {
          caution_score: 95,
          caution_label: "Red-flag / avoid or defer unless essential",
          caution_drivers: ["official advisory includes against-all-travel language"],
          news_attention_level: "limited",
          news_attention_label: "Limited relevant recent news coverage",
          coverage_confidence: "medium-high",
          checked_at: "2026-07-10T17:00:00.000Z",
        },
      },
    },
    {
      tool: "local_experiences_and_attractions",
      status: "success",
      result: {
        location: "Abuja, Nigeria",
        recommendations: [
          { name: "Central Park", rating: 4.3, review_count: 1876, open_now: true, address: "Garki, Abuja" },
          { name: "Millennium Park", rating: 4.3, review_count: 5309, open_now: true, address: "Three Arms Zone, Abuja" },
          { name: "Magic Land", rating: 4.3, review_count: 6011, open_now: true, address: "Wuye, Abuja" },
        ],
      },
    },
  ]);
  assert.doesNotMatch(answer, /\*\*Vibe and local context\*\*/);
  assert.doesNotMatch(answer, /\*\*Practical travel notes\*\*/);
  assert.doesNotMatch(answer, /Security headline/);
  assert.doesNotMatch(answer, /Magic Land/);
});

test("unreviewed country intros do not say a country is inside itself", () => {
  const resolved = {
    intent: { type: "destination_planning" },
    destination: "Rwanda",
    locations: ["Rwanda"],
    locationScope: "country",
    memory: { locations: ["Rwanda"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_safety_intelligence",
      status: "success",
      result: {
        location: "Rwanda",
        country: "Rwanda",
        current_situation: [],
        official_advisory_links: toolService._test.officialAdvisoryLinks("Kigali", "Rwanda"),
        safety_assessment: {
          caution_score: 82,
          caution_label: "High caution",
          caution_drivers: ["official advisory includes against-all-but-essential-travel language"],
          news_attention_level: "limited",
          news_attention_label: "Limited relevant recent news coverage",
          coverage_confidence: "medium-high",
          checked_at: "2026-07-10T16:30:00.000Z",
        },
      },
    },
  ]);
  assert.match(answer, /^\*\*Rwanda\*\*/);
  assert.match(answer, /Rwanda needs city- or region-level planning/);
  assert.doesNotMatch(answer, /Rwanda is in Rwanda/);
  assert.doesNotMatch(answer, /current news signal for Rwanda is high-attention/);
  assert.match(answer, /\*\*Local planning\*\*/);
  assert.match(answer, /\*\*Food\*\*/);
  assert.match(answer, /\*\*Local notes\*\*/);
});

test("city answers do not display stale cities from another country", () => {
  const weatherResult = {
    tool: "comprehensive_weather_analysis",
    status: "success",
    result: {
      location: "Abu Dhabi - United Arab Emirates",
      current_conditions: {
        description: "overcast clouds",
        temperature: 32,
        feels_like: 39,
        wind_speed: 21,
      },
      hourly_forecast: [],
    },
  };
  const resolved = {
    intent: { type: "destination_planning", isFollowUp: true },
    destination: "Abu Dhabi",
    locations: ["Abu Dhabi", "United Arab Emirates", "Iran"],
    locationScope: "city",
    memory: { locations: ["Iran", "Tehran", "United Arab Emirates", "Abu Dhabi"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [weatherResult]);
  assert.match(answer, /^\*\*Abu Dhabi\*\*/);
  assert.doesNotMatch(answer.split("\n\n")[0], /Tehran|Iran/);
  assert.doesNotMatch(answer, /Abu Dhabi and Tehran/);
});

test("unknown city-only answers do not display stale activity locations", () => {
  const resolved = {
    intent: { type: "destination_planning", isFollowUp: true, locationOnlyFollowUp: true },
    destination: "Dharan",
    locations: ["Dharan"],
    locationScope: "city",
    memory: { locations: ["Nepal", "Riihimäki", "Dharan"], interests: ["tennis"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_weather_analysis",
      status: "success",
      result: {
        location: "Dharan, Nepal",
        current_conditions: { description: "cloudy", temperature: 26, feels_like: 27, wind_speed: 5 },
        hourly_forecast: [],
      },
    },
    {
      tool: "local_experiences_and_attractions",
      status: "success",
      result: {
        location: "Dharan, Nepal",
        recommendations: [
          { name: "Dharan Clock Tower", rating: 4.3, review_count: 2780, open_now: true, address: "Dharan, Nepal" },
          { name: "Chinde Dada viewpoint", rating: 4.4, review_count: 321, open_now: true, address: "Dharan, Nepal" },
        ],
      },
    },
  ]);
  assert.match(answer, /^\*\*Dharan\*\*/);
  assert.match(answer, /Dharan is in Nepal/);
  assert.match(answer, /landmarks and memorials|parks, viewpoints or outdoor stops/);
  assert.doesNotMatch(answer, /best planned by matching the trip purpose with the right base area/);
  assert.doesNotMatch(answer.split("\n\n")[0], /Riihimäki|Nepal and Dharan|Dharan and/);
});

test("unknown same-country city follow-ups do not repeat country safety blocks", () => {
  const resolved = {
    intent: { type: "destination_planning", isFollowUp: true, locationOnlyFollowUp: true },
    destination: "Dharan",
    locations: ["Dharan"],
    locationScope: "city",
    memory: { destination: "Nepal", locations: ["Dharan"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_safety_intelligence",
      status: "success",
      result: {
        location: "Dharan",
        country: "Nepal",
        current_situation: [],
        safety_assessment: {
          caution_score: 48,
          caution_label: "Moderate caution",
          news_attention_level: "elevated",
          news_attention_label: "Elevated-attention recent news coverage",
          coverage_confidence: "medium-high",
          checked_at: "2026-07-10T16:01:00.000Z",
        },
      },
    },
    {
      tool: "comprehensive_weather_analysis",
      status: "success",
      result: {
        location: "Dharan, Nepal",
        current_conditions: { description: "cloudy", temperature: 26, feels_like: 27, wind_speed: 5 },
        hourly_forecast: [],
      },
    },
  ]);
  assert.match(answer, /^\*\*Dharan\*\*/);
  assert.doesNotMatch(answer, /\*\*Safety and current context\*\*/);
});

test("same-country city follow-ups suppress safety using previous country destination", () => {
  const resolved = {
    intent: { type: "destination_planning", isFollowUp: true, locationOnlyFollowUp: true },
    destination: "Kigali",
    locations: ["Kigali"],
    locationScope: "city",
    memory: { destination: "Rwanda", locations: ["Kigali"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_safety_intelligence",
      status: "success",
      result: {
        location: "Kigali",
        country: "Rwanda",
        current_situation: [],
        safety_assessment: {
          caution_score: 82,
          caution_label: "High caution",
          news_attention_level: "limited",
          news_attention_label: "Limited relevant recent news coverage",
          coverage_confidence: "medium-high",
          checked_at: "2026-07-10T16:31:00.000Z",
        },
      },
    },
    {
      tool: "comprehensive_weather_analysis",
      status: "success",
      result: {
        location: "Kigali, Rwanda",
        current_conditions: { description: "overcast clouds", temperature: 24, feels_like: 24, wind_speed: 5 },
        hourly_forecast: [],
      },
    },
  ]);
  assert.match(answer, /^\*\*Kigali\*\*/);
  assert.doesNotMatch(answer, /\*\*Safety and current context\*\*/);
});

test("city refinement stays city-scoped and avoids internal fallback wording", () => {
  const resolved = {
    intent: { type: "destination_planning", isFollowUp: true, locationOnlyFollowUp: true },
    destination: "Kathmandu",
    locations: ["Kathmandu"],
    locationScope: "city",
    memory: { locations: ["Nepal", "Kathmandu"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_weather_analysis",
      status: "success",
      result: {
        location: "Kathmandu 44600, Nepal",
        current_conditions: { description: "broken clouds", temperature: 22, feels_like: 22, wind_speed: 5 },
        hourly_forecast: [],
      },
    },
    {
      tool: "local_experiences_and_attractions",
      status: "success",
      result: {
        location: "Kathmandu",
        recommendations: [
          { name: "Kathmandu Durbar Square", rating: 4.5, review_count: 1000, open_now: true, address: "Kathmandu 44600, Nepal" },
        ],
      },
    },
  ]);
  assert.match(answer, /Kathmandu is Nepal’s busy cultural and logistics hub/);
  assert.match(answer, /\*\*What to do\*\*/);
  assert.doesNotMatch(answer, /\*\*Food to try\*\*/);
  assert.doesNotMatch(answer, /\*\*Food and stay notes\*\*/);
  assert.doesNotMatch(answer, /\*\*Food, stays and local experience\*\*/);
  assert.doesNotMatch(answer, /Thamel: easiest for first-time tourists/);
  assert.doesNotMatch(answer, /\*\*Planning fallback\*\*/);
  assert.doesNotMatch(answer, /Pokhara|Lakeside/);
});

test("fallback advisory links are country-specific global sources", () => {
  const links = toolService._test.officialAdvisoryLinks("Helsinki", "Finland");
  assert.deepEqual(links.map((item) => item.name), [
    "WHO health profile for Finland",
    "ReliefWeb updates for Finland",
  ]);
  assert.equal(links[0].url, "https://www.who.int/countries/fin");
  assert.equal(links[1].url, "https://reliefweb.int/country/fin");
  assert.doesNotMatch(links.map((item) => item.name).join(" "), /IATA|Finland MFA|FCDO|State Department/i);
  assert.deepEqual(toolService._test.officialAdvisoryLinks("Unknown Place", ""), []);
});

test("visible advisory notes prefer country-specific global links over one government board", () => {
  const resolved = {
    intent: { type: "destination_planning" },
    destination: "Japan",
    locations: ["Japan"],
    locationScope: "country",
    memory: { locations: ["Japan"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_safety_intelligence",
      status: "success",
      result: {
        current_situation: [],
        official_advisory: {
          title: "Japan travel advice",
          source: "UK Foreign, Commonwealth & Development Office",
          url: "https://www.gov.uk/foreign-travel-advice/japan",
        },
        official_advisory_links: toolService._test.officialAdvisoryLinks("Tokyo", "Japan"),
        safety_assessment: {
          caution_score: 20,
          caution_label: "Low / normal travel planning",
          news_attention_level: "limited",
          news_attention_label: "Limited relevant recent news coverage",
          coverage_confidence: "medium",
          checked_at: "2026-07-09T12:00:00.000Z",
        },
      },
    },
  ]);
  assert.match(answer, /WHO health profile for Japan/);
  assert.match(answer, /https:\/\/www\.who\.int\/countries\/jpn/);
  assert.match(answer, /ReliefWeb updates for Japan/);
  assert.match(answer, /https:\/\/reliefweb\.int\/country\/jpn/);
  assert.doesNotMatch(answer, /IATA Travel Centre/);
  assert.doesNotMatch(answer, /Foreign, Commonwealth|FCDO|Finland MFA|State Department/);
});

test("country safety wording stays concise and avoids duplicated practical notes", () => {
  const resolved = {
    intent: { type: "destination_planning" },
    destination: "Nepal",
    locations: ["Nepal"],
    locationScope: "country",
    memory: { locations: ["Nepal"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_safety_intelligence",
      status: "success",
      result: {
        current_situation: [],
        official_advisory_links: toolService._test.officialAdvisoryLinks("Kathmandu", "Nepal"),
        safety_assessment: {
          caution_score: 48,
          caution_label: "Moderate caution",
          caution_drivers: ["moderate infrastructure baseline", "recent civil disruption coverage"],
          news_attention_level: "elevated",
          news_attention_label: "Elevated-attention recent news coverage",
          coverage_confidence: "medium-high",
          checked_at: "2026-07-10T15:44:00.000Z",
        },
      },
    },
  ]);
  assert.match(answer, /ATLAS caution score: 48\/100 — Moderate caution\. Use it as a planning signal/);
  assert.doesNotMatch(answer, /ATLAS caution score is a planning signal|classification describes retrieved news coverage|country-level guess/i);
  assert.doesNotMatch(answer, /\*\*Practical travel notes\*\*[\s\S]*Dress respectfully around temples/);
});

test("safety summaries dedupe duplicate news and do not overstate news attention from caution score", () => {
  const resolved = {
    intent: { type: "destination_planning" },
    destination: "Rwanda",
    locations: ["Rwanda"],
    locationScope: "country",
    memory: { locations: ["Rwanda"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [
    {
      tool: "comprehensive_safety_intelligence",
      status: "success",
      result: {
        location: "Rwanda",
        country: "Rwanda",
        current_situation: [
          { headline: "DR Congo takes Rwanda to international court over decades of conflict", source: "BBC News", published: "2026-06-26T00:00:00.000Z", summary: "Conflict-related article", url: "https://example.com/a" },
          { headline: "DR Congo takes Rwanda to international court over decades of conflict", source: "BBC News", published: "2026-06-26T12:00:00.000Z", summary: "Duplicate", url: "https://example.com/b" },
        ],
        safety_assessment: {
          caution_score: 82,
          caution_label: "High caution",
          caution_drivers: ["official advisory includes against-all-but-essential-travel language"],
          news_attention_level: "limited",
          news_attention_label: "Limited relevant recent news coverage",
          coverage_confidence: "medium-high",
          checked_at: "2026-07-10T16:30:00.000Z",
        },
      },
    },
  ]);
  assert.match(answer, /ATLAS sees high caution for Rwanda/);
  assert.doesNotMatch(answer, /current news signal for Rwanda is high-attention/);
  assert.equal((answer.match(/DR Congo takes Rwanda/g) || []).length, 1);
});

test("ordinary destination safety news ignores unrelated sports and crypto mentions", () => {
  assert.equal(toolService._test.isRelevantNewsArticle({
    title: "Wolff: I wish Abu Dhabi 2021 had been handled like the F1 British GP",
    description: "A racing retrospective mentions Abu Dhabi but is not travel safety guidance.",
    source: { name: "autosport.com" },
  }, "Abu Dhabi", "United Arab Emirates"), false);

  assert.equal(toolService._test.isRelevantNewsArticle({
    title: "Crypto News: Pepeto Ships Top Security Upgrade While XRP Price Prediction Targets $20",
    description: "The article mentions the UAE market but is not tourist safety news.",
    source: { name: "GlobeNewswire" },
  }, "Abu Dhabi", "United Arab Emirates"), false);

  assert.equal(toolService._test.isRelevantNewsArticle({
    title: "Calls for Sudan 'Ceasefire Now' Grow as 300+ Children Killed, Wounded in 2026 Alone",
    description: "Demands for a ceasefire in Sudan's civil war mounted after reports from the United Nations.",
    source: { name: "Common Dreams" },
  }, "Abu Dhabi", "United Arab Emirates"), false);

  assert.equal(toolService._test.isRelevantNewsArticle({
    title: "IHH hospitals in India, Singapore saw fewer patients from Middle East due to war",
    description: "Hospitals saw fewer patients from the UAE and Saudi Arabia as regional instability creates uncertainty for businesses.",
    source: { name: "The Times of India" },
  }, "Abu Dhabi", "United Arab Emirates"), false);
});

test("attraction discovery filters low-value transport utility places", () => {
  assert.equal(toolService._test.isLowValueAttractionPlace({
    displayName: { text: "Dharan Bus Park" },
    formattedAddress: "Dharan 56700, Nepal",
    types: ["bus_station", "point_of_interest", "establishment"],
  }), true);

  assert.equal(toolService._test.isLowValueAttractionPlace({
    displayName: { text: "Kigali International Airport Park" },
    formattedAddress: "Kigali, Rwanda",
    types: ["park", "point_of_interest", "establishment"],
  }), true);

  assert.equal(toolService._test.isLowValueAttractionPlace({
    displayName: { text: "Dharan Clock Tower" },
    formattedAddress: "Dharan 56700, Nepal",
    types: ["tourist_attraction", "point_of_interest", "establishment"],
  }), false);
});

test("city discovery removes far-away places when local results exist", () => {
  const places = [
    { id: "local", location: { latitude: 60.397, longitude: 25.66 } },
    { id: "far", location: { latitude: 60.25, longitude: 24.95 } },
  ];
  const filtered = toolService._test.spatiallyRelevantPlaces(places, 60.397, 25.66, 20);
  assert.deepEqual(filtered.map((place) => place.id), ["local"]);
});

test("accessible indoor activity searches prioritize museums and libraries over playgrounds", () => {
  const plan = toolService._test.activityPlan(
    "old town accessible indoor museums libraries cultural attractions",
    "old town, Tallinn",
  );
  const queries = plan.map((step) => `${step.type || ""} ${step.query || ""}`).join("\n");
  assert.match(queries, /accessible indoor museums/);
  assert.match(queries, /library/);
  assert.doesNotMatch(queries, /playground/);
});

test("street-food discovery avoids broad restaurant searches", () => {
  const plan = toolService._test.restaurantPlan("street food", "Osaka");
  const queries = plan.map((step) => step.query || step.term || "");
  assert.ok(queries.some((query) => /street food in Osaka/i.test(query)));
  assert.ok(queries.some((query) => /food markets in Osaka/i.test(query)));
  assert.equal(plan.some((step) => step.mode === "nearby" && step.type === "restaurant"), false);
});

test("multi-city destination answers label one live weather check and balance city planning", () => {
  const weatherResult = {
    tool: "comprehensive_weather_analysis",
    status: "success",
    result: {
      location: "Kathmandu 44600, Nepal",
      current_conditions: {
        description: "light rain",
        temperature: 22,
        feels_like: 22,
        wind_speed: 4,
      },
      hourly_forecast: [
        { time: "Sat 09:00", temperature: 23, description: "light rain", rain_probability: 80 },
      ],
    },
  };
  const resolved = {
    intent: { type: "destination_planning", isFollowUp: true, locationOnlyFollowUp: true },
    destination: "kathmandu",
    locations: ["kathmandu", "pokhara"],
    locationScope: "city",
    memory: { locations: ["nepal", "kathmandu", "pokhara"] },
  };
  const answer = chatController._test.composeDestinationPipelineAnswer(resolved, [weatherResult]);
  assert.match(answer, /Live weather checked for Kathmandu/);
  assert.match(answer, /\*\*City-by-city timing\*\*/);
  assert.match(answer, /Pokhara: check a separate live forecast/i);
  assert.match(answer, /\*\*Base split\*\*/);
});

test("cache service stores and retrieves with development memory fallback", async () => {
  const key = cacheKey("test", { b: 2, a: 1 });
  let calls = 0;
  const first = await getOrSetCache(key, 30, async () => {
    calls += 1;
    return { ok: true };
  });
  const second = await getOrSetCache(key, 30, async () => {
    calls += 1;
    return { ok: false };
  });

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.value.ok, true);
  assert.equal(calls, 1);
});

test("cache status reads Redis configuration after environment initialization", () => {
  const previous = process.env.REDIS_URL;
  try {
    delete process.env.REDIS_URL;
    assert.equal(cacheStatus().redisConfigured, false);
    process.env.REDIS_URL = "redis://localhost:6379";
    assert.equal(cacheStatus().redisConfigured, true);
  } finally {
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  }
});

test("document signature validation accepts PDF and rejects mismatched DOCX", () => {
  assert.equal(hasAllowedSignature({ originalname: "file.pdf", buffer: Buffer.from("%PDF-test") }), true);
  assert.equal(hasAllowedSignature({ originalname: "file.docx", buffer: Buffer.from("not-a-zip") }), false);
});

test("chat rate limiter is configured as middleware", () => {
  assert.equal(typeof chatRateLimiter, "function");
});

test("development mode bypasses daily usage budgets by default", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousEnforce = process.env.ENFORCE_DEVELOPMENT_LIMITS;
  process.env.NODE_ENV = "development";
  delete process.env.ENFORCE_DEVELOPMENT_LIMITS;
  try {
    assert.equal(usageService._test.developmentUsageLimitsDisabled(), true);
    const chat = await usageService.reserveChat(new mongoose.Types.ObjectId());
    const provider = await usageService.reserveProviderUsage(new mongoose.Types.ObjectId(), { externalCalls: 1000, llmCalls: 1000 });
    assert.equal(chat.allowed, true);
    assert.equal(chat.developmentBypass, true);
    assert.equal(provider.allowed, true);
    assert.equal(provider.developmentBypass, true);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousEnforce === undefined) delete process.env.ENFORCE_DEVELOPMENT_LIMITS;
    else process.env.ENFORCE_DEVELOPMENT_LIMITS = previousEnforce;
  }
});

test("chat requests require a UUID idempotency key", () => {
  const valid = validate(chatRequestSchema, { clientRequestId: crypto.randomUUID(), message: "hello", documentIds: [] });
  const invalid = validate(chatRequestSchema, { message: "hello", documentIds: [] });
  assert.equal(valid.error, null);
  assert.match(invalid.error, /request ID/i);
});

test("signup requires explicit privacy acceptance", () => {
  const base = { name: "Test User", email: "test@example.com", password: "Password1234" };
  assert.match(validate(authSignupSchema, base).error, /privacy policy/i);
  assert.equal(validate(authSignupSchema, { ...base, privacyAccepted: true }).error, null);
});

test("refresh sessions use HttpOnly cookies and email actions use URL fragments", () => {
  const options = sessionService._test.cookieOptions();
  assert.equal(options.httpOnly, true);
  assert.equal(options.path, "/api/auth");
  assert.equal(sessionService._test.parseCookies("one=1; atlas_refresh=secret").atlas_refresh, "secret");
  assert.equal(sessionService._test.safeEqual("matching", "matching"), true);
  assert.equal(sessionService._test.safeEqual("matching", "different"), false);
  assert.match(emailService.verificationLink("a".repeat(32)), /verify-email#token=/);
  assert.match(emailService.resetLink("b".repeat(32)), /reset-password#token=/);
});

test("Routes API v2 responses are converted to compact route guidance", () => {
  const route = toolService._test.compactRouteLeg({
    description: "Fast route",
    distanceMeters: 12500,
    duration: "3900s",
    legs: [{ steps: [{ distanceMeters: 800, staticDuration: "600s", travelMode: "WALK", navigationInstruction: { instructions: "Walk north" } }] }],
  }, "Helsinki", "Porvoo");
  assert.equal(route.summary, "Fast route");
  assert.equal(route.distance, "13 km");
  assert.equal(route.duration, "1 hr 5 min");
  assert.equal(route.steps[0].instruction, "Walk north");
});

test("tool execution stops immediately for an aborted request", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    toolService.executeTool("route_and_transport_planner", { origin: "A", destination: "B" }, { signal: controller.signal }),
    (error) => error.code === "ERR_CANCELED",
  );
});

test("privacy, idempotency, usage and processing fields are indexed", () => {
  assert.ok(User.schema.path("legalAcceptance.privacyVersion"));
  assert.ok(Session.schema.path("refreshTokenHash"));
  assert.ok(ChatRequest.schema.path("clientRequestId"));
  assert.ok(DailyUsage.schema.path("chatRequests"));
  assert.ok(Document.schema.path("processingStatus"));
  assert.ok(Document.schema.path("leaseOwner"));
  assert.ok(User.schema.path("deletionPending"));
  assert.ok(AccountDeletion.schema.path("leaseOwner"));
  const accountUserIndex = AccountDeletion.schema.indexes().find(([fields]) => fields.userId === 1);
  assert.equal(accountUserIndex?.[1]?.unique, true);
  assert.deepEqual(accountUserIndex?.[1]?.partialFilterExpression, { userId: { $type: "objectId" } });
  assert.ok(StorageUsage.schema.path("documentCount"));
  assert.ok(OperationLease.schema.path("expiresAt"));
  assert.ok(DocumentDeletion.schema.path("leaseOwner"));
  assert.ok(WorkerHeartbeat.schema.path("lastSeenAt"));
  assert.ok(GlobalUsage.schema.path("providerCalls"));
  assert.equal(usageService._test.dayKey(new Date("2026-06-22T12:00:00Z")), "2026-06-22");
});

test("account deletion purges every user-scoped in-memory rate-limit record", async () => {
  const userId = "507f1f77bcf86cd799439011";
  const keys = rateLimiterTestUtils.userScopedRateLimitKeys(userId);
  keys.forEach((key) => rateLimiterTestUtils.seedFallback(key));
  rateLimiterTestUtils.seedFallback("atlas:future-user-feature:user:507f1f77bcf86cd799439011");
  rateLimiterTestUtils.seedFallback("atlas:chat:user:different-user");

  const result = await purgeUserRateLimitState(userId);

  assert.equal(result.memoryDeleted, keys.length + 1);
  keys.forEach((key) => assert.equal(rateLimiterTestUtils.hasFallback(key), false));
  assert.equal(rateLimiterTestUtils.hasFallback("atlas:future-user-feature:user:507f1f77bcf86cd799439011"), false);
  assert.equal(rateLimiterTestUtils.hasFallback("atlas:chat:user:different-user"), true);
});

test("account deletion cannot skip Pinecone when document vector state exists", () => {
  assert.equal(documentMayHaveRemoteVectors({ vectorStatus: "indexed" }), true);
  assert.equal(documentMayHaveRemoteVectors({ vectorRecordCount: 2 }), true);
  assert.equal(documentMayHaveRemoteVectors({ vectorIndexedAt: new Date() }), true);
  assert.equal(documentMayHaveRemoteVectors({ vectorNamespace: "atlas-user-example" }), true);
  assert.equal(documentMayHaveRemoteVectors({ vectorStatus: "skipped", vectorRecordCount: 0 }), false);
});

test("provider circuits ignore permanent client errors and local budget rejection", () => {
  assert.equal(toolService._test.shouldRecordProviderFailure({ status: 400 }), false);
  assert.equal(toolService._test.shouldRecordProviderFailure({ status: 404 }), false);
  assert.equal(toolService._test.shouldRecordProviderFailure({ status: 429 }), true);
  assert.equal(toolService._test.shouldRecordProviderFailure({ status: 503 }), true);
  assert.equal(toolService._test.shouldRecordProviderFailure({ code: "PROVIDER_BUDGET_EXCEEDED", status: 429 }), false);
  assert.equal(toolService._test.shouldRecordProviderFailure(new Error("network failure")), true);
});

test("provider circuit opens after repeated failures and resets after success", () => {
  const previous = process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD;
  process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD = "2";
  toolService._test.recordProviderFailure("test-provider");
  toolService._test.recordProviderFailure("test-provider");
  assert.throws(() => toolService._test.assertCircuitClosed("test-provider"), /circuit/i);
  toolService._test.recordProviderSuccess("test-provider");
  assert.doesNotThrow(() => toolService._test.assertCircuitClosed("test-provider"));
  if (previous === undefined) delete process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD;
  else process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD = previous;
});

test("security and conversation memory fields are persisted by the schemas", () => {
  assert.ok(User.schema.path("tokenVersion"));
  assert.ok(Conversation.schema.path("memory.locationScope"));
  assert.ok(Conversation.schema.path("memory.pendingActivitySearch.activity"));
  assert.ok(Conversation.schema.path("memory.route.origin"));
  assert.ok(Conversation.schema.path("memory.targetDate"));
  assert.ok(Conversation.schema.path("memory.constraints.dayCount"));
  assert.ok(Conversation.schema.path("memory.constraints.noCar"));
  assert.ok(Conversation.schema.path("memory.constraints.origin"));
});

test("document chunks overlap without exceeding their maximum size", () => {
  const chunks = documentService.chunkText("travel planning context ".repeat(200), 240, 40);
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 240));
  const tail = chunks[0].text.slice(-25).trim();
  assert.ok(chunks[1].text.includes(tail.split(" ").at(-1)));
});

test("destination memory without optional route fields validates", async () => {
  const resolved = contextService.resolveContext(
    "I am thinking to travel to Tehran this weekend as a tourist",
    {},
    [],
  );
  const normalized = normalizeConversationMemory({
    ...resolved.memory,
    route: undefined,
    pendingActivitySearch: undefined,
  });
  const conversation = new Conversation({
    userId: new mongoose.Types.ObjectId(),
    title: "Tehran trip",
    memory: normalized,
  });

  await conversation.validate();
  assert.equal(conversation.memory.destination.toLowerCase(), "tehran");
  assert.equal(conversation.memory.route, undefined);
  assert.equal(conversation.memory.pendingActivitySearch, undefined);
});

import { namespaceFor, vectorStore } from "../services/vectorStore.js";

test("Pinecone namespace is isolated per user and metadata is flat", () => {
  const namespace = namespaceFor("64ffabc123");
  assert.equal(namespace, "atlas-user-64ffabc123");

  const metadata = vectorStore._test.sanitizeMetadata({
    userId: "u1",
    documentId: "d1",
    chunkIndex: 2,
    nested: { unsafe: true },
    empty: null,
    tags: ["a", "b", 12],
  });

  assert.deepEqual(metadata, {
    userId: "u1",
    documentId: "d1",
    chunkIndex: 2,
    tags: ["a", "b"],
  });
});

test("Pinecone can be disabled without breaking local document fallback", async () => {
  const previous = process.env.PINECONE_ENABLED;
  process.env.PINECONE_ENABLED = "false";
  assert.equal(vectorStore.isConfigured(), false);
  assert.match(vectorStore.configurationIssue(), /disabled/i);
  process.env.PINECONE_ENABLED = previous;
});

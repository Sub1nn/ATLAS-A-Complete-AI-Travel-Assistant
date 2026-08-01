import assert from "node:assert/strict";
import test from "node:test";
import {
  atlasThreadId,
  runAtlasAuthoritativeWorkflow,
  runAtlasShadowWorkflow,
  shouldUseAtlasAuthoritativeGraph,
} from "../agents/atlasGraph.js";
import { atlasTracingTestUtils } from "../agents/monitoring/atlasTracing.js";
import { assertAgentEnvironment } from "../utils/security.js";
import { logger } from "../utils/logger.js";
import { travelPlannerService } from "../services/travelPlannerService.js";
import { contextService } from "../services/contextService.js";
import { assessResponseQuality } from "../agents/nodes/orchestrationNodes.js";
import {
  atlasResponseModelTestUtils,
  renderStructuredAtlasResponse,
} from "../agents/models/atlasResponseModel.js";
import { chatController } from "../controllers/chatController.js";

process.env.NODE_ENV = "test";

test("agent thread IDs are deterministic and do not expose database IDs", () => {
  const first = atlasThreadId("user-123", "conversation-456");
  const same = atlasThreadId("user-123", "conversation-456");
  const other = atlasThreadId("user-123", "conversation-789");

  assert.equal(first, same);
  assert.notEqual(first, other);
  assert.match(first, /^atlas:[a-f0-9]{64}$/);
  assert.equal(first.includes("user-123"), false);
  assert.equal(first.includes("conversation-456"), false);
});

test("shadow graph detects destination switches and retains multiple locations", async () => {
  const previous = process.env.ATLAS_AGENT_SHADOW_MODE;
  process.env.ATLAS_AGENT_SHADOW_MODE = "true";
  try {
    const switched = await runAtlasShadowWorkflow({
      message: "What about Abu Dhabi instead?",
      memory: { destination: "Tehran", locations: ["Tehran"] },
      previousMessages: [],
      userId: "user-a",
      conversationId: "conversation-a",
    });
    assert.equal(switched.contextSwitch, true);
    assert.equal(switched.destinationChanged, true);
    assert.deepEqual(switched.warningCodes, []);

    const multiple = await runAtlasShadowWorkflow({
      message: "Kathmandu and Pokhara",
      memory: { destination: "Nepal", locations: ["Nepal"] },
      previousMessages: [],
      userId: "user-a",
      conversationId: "conversation-b",
    });
    assert.equal(multiple.explicitLocationCount, 2);
    assert.equal(multiple.resolvedLocationCount, 2);
    assert.equal(multiple.warningCodes.includes("MULTI_DESTINATION_LOSS"), false);
  } finally {
    if (previous === undefined) delete process.env.ATLAS_AGENT_SHADOW_MODE;
    else process.env.ATLAS_AGENT_SHADOW_MODE = previous;
  }
});

test("LangSmith payload sanitization never includes raw prompts or secrets", () => {
  const rawSecret = "lsv2_pt_example_secret";
  const summary = atlasTracingTestUtils.summarizeValue({
    prompt: "Tell me where I live",
    apiKey: rawSecret,
    intent: "route_planning",
    toolCount: 3,
  });
  const serialized = JSON.stringify(summary);

  assert.equal(serialized.includes("Tell me where I live"), false);
  assert.equal(serialized.includes(rawSecret), false);
  assert.equal(summary.intent, "route_planning");
  assert.equal(summary.toolCount, 3);
  assert.equal(logger.redact(`key=${rawSecret}`).includes(rawSecret), false);
});

test("sanitized LangSmith runs stay explicitly enabled while automatic tracing is disabled", () => {
  const previousProject = process.env.LANGSMITH_PROJECT;
  try {
    process.env.LANGSMITH_PROJECT = "Atlas-AI";
    const config = atlasTracingTestUtils.sanitizedTraceConfig(
      "atlas-test-trace",
      {},
      { phase: "test", prompt: "must not be included" },
      ["diagnostic"],
    );
    assert.equal(config.tracingEnabled, true);
    assert.equal(config.project_name, "Atlas-AI");
    assert.equal(config.metadata.phase, "test");
    assert.equal("prompt" in config.metadata, false);
  } finally {
    if (previousProject === undefined) delete process.env.LANGSMITH_PROJECT;
    else process.env.LANGSMITH_PROJECT = previousProject;
  }
});

test("agent environment validation fails clearly for unsafe tracing configuration", () => {
  const previous = {
    graph: process.env.ATLAS_AGENT_GRAPH_ENABLED,
    canary: process.env.ATLAS_AGENT_CANARY_PERCENT,
    fallback: process.env.ATLAS_AGENT_FALLBACK_ENABLED,
    timeout: process.env.ATLAS_AGENT_REQUEST_TIMEOUT_MS,
    tracing: process.env.LANGSMITH_TRACING,
    key: process.env.LANGSMITH_API_KEY,
    rate: process.env.LANGSMITH_TRACING_SAMPLING_RATE,
    ttl: process.env.ATLAS_AGENT_CHECKPOINT_TTL_SECONDS,
  };

  try {
    process.env.ATLAS_AGENT_GRAPH_ENABLED = "true";
    process.env.ATLAS_AGENT_CANARY_PERCENT = "101";
    assert.throws(() => assertAgentEnvironment(), /between 0 and 100/);
    process.env.ATLAS_AGENT_CANARY_PERCENT = "100";
    process.env.ATLAS_AGENT_REQUEST_TIMEOUT_MS = "100";
    assert.throws(() => assertAgentEnvironment(), /between 5000 and 120000/);
    process.env.ATLAS_AGENT_REQUEST_TIMEOUT_MS = "60000";
    assert.doesNotThrow(() => assertAgentEnvironment());
    process.env.ATLAS_AGENT_GRAPH_ENABLED = "false";

    process.env.LANGSMITH_TRACING = "true";
    delete process.env.LANGSMITH_API_KEY;
    assert.throws(() => assertAgentEnvironment(), /LANGSMITH_API_KEY/);

    process.env.LANGSMITH_API_KEY = "configured-test-key";
    process.env.LANGSMITH_TRACING_SAMPLING_RATE = "2";
    assert.throws(() => assertAgentEnvironment(), /between 0 and 1/);

    process.env.LANGSMITH_TRACING_SAMPLING_RATE = "0.1";
    process.env.ATLAS_AGENT_CHECKPOINT_TTL_SECONDS = "60";
    assert.throws(() => assertAgentEnvironment(), /at least 3600/);

    process.env.ATLAS_AGENT_CHECKPOINT_TTL_SECONDS = "3600";
    assert.doesNotThrow(() => assertAgentEnvironment());
  } finally {
    for (const [key, value] of Object.entries({
      ATLAS_AGENT_GRAPH_ENABLED: previous.graph,
      ATLAS_AGENT_CANARY_PERCENT: previous.canary,
      ATLAS_AGENT_FALLBACK_ENABLED: previous.fallback,
      ATLAS_AGENT_REQUEST_TIMEOUT_MS: previous.timeout,
      LANGSMITH_TRACING: previous.tracing,
      LANGSMITH_API_KEY: previous.key,
      LANGSMITH_TRACING_SAMPLING_RATE: previous.rate,
      ATLAS_AGENT_CHECKPOINT_TTL_SECONDS: previous.ttl,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("LangChain planner rollout remains explicitly feature flagged", () => {
  const previous = process.env.ATLAS_LANGCHAIN_PLANNER_ENABLED;
  try {
    delete process.env.ATLAS_LANGCHAIN_PLANNER_ENABLED;
    assert.equal(travelPlannerService.isLangChainEnabled(), false);
    process.env.ATLAS_LANGCHAIN_PLANNER_ENABLED = "true";
    assert.equal(travelPlannerService.isLangChainEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.ATLAS_LANGCHAIN_PLANNER_ENABLED;
    else process.env.ATLAS_LANGCHAIN_PLANNER_ENABLED = previous;
  }
});

test("planner cannot turn a high-confidence dining request into a sports activity", () => {
  const resolved = {
    destination: "Osaka",
    locations: ["Osaka"],
    enrichedUserMessage: "Plan one relaxed day in Osaka around street food and an easy evening.",
    intent: { type: "dining_recommendations", confidence: 0.93, isFollowUp: false },
    memory: { destination: "Osaka", locations: ["Osaka"], interests: [] },
  };
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "activity_recommendations",
    confidence: 0.88,
    destination: "Osaka",
    location_scope: "city",
    activity: "street food",
  });
  assert.equal(planned.intent.type, "dining_recommendations");
  assert.equal(planned.activityRequest, undefined);
});

test("planner cannot expand an explicit city into an intent phrase", () => {
  const resolved = {
    destination: "Osaka",
    locations: ["Osaka"],
    enrichedUserMessage: "Plan one relaxed day in Osaka around street food.",
    intent: { type: "destination_planning", confidence: 0.91 },
    memory: { destination: "Osaka", locations: ["Osaka"] },
  };
  const planned = travelPlannerService.applyTravelPlan(resolved, {
    intent: "destination_planning",
    confidence: 0.9,
    destination: "Osaka around street food",
    location_scope: "city",
  });
  assert.equal(planned.destination, "Osaka");
  assert.deepEqual(planned.locations, ["Osaka"]);
});

test("authoritative graph owns planning, tool routing, composition and verification", async () => {
  const previousGraph = process.env.ATLAS_AGENT_GRAPH_ENABLED;
  process.env.ATLAS_AGENT_GRAPH_ENABLED = "true";
  const calls = [];
  const resolved = {
    intent: { type: "destination_planning" },
    destination: "Paris",
    locations: ["Paris"],
    memory: { destination: "Paris", locations: ["Paris"] },
    enrichedUserMessage: "Plan a weekend in Paris",
  };
  const answer = "Paris works best as a compact weekend when you group nearby sights and leave time for meals. Choose one main area each day and keep transfers short.";
  const runtime = {
    resolveContext: async () => {
      calls.push("context");
      return resolved;
    },
    planRequest: async ({ baseResolved }) => {
      calls.push("plan");
      return { planner: { intent: "destination_planning", confidence: 0.9 }, resolved: baseResolved };
    },
    retrieveDocuments: async () => {
      calls.push("retrieve");
      return [];
    },
    selectTools: async () => {
      calls.push("route");
      return ["local_experiences_and_attractions"];
    },
    executeTools: async () => {
      calls.push("tools");
      return {
        toolResults: [{ tool: "local_experiences_and_attractions", status: "success", result: { places: [] } }],
        successfulToolResults: [{ tool: "local_experiences_and_attractions", status: "success", result: { places: [] } }],
      };
    },
    composeResponse: async () => {
      calls.push("compose");
      return answer;
    },
    verifyResponse: async ({ answer: input }) => {
      calls.push("verify");
      return { answer: input, verification: { modified: false, notes: [] } };
    },
    repairResponse: async ({ answer: input }) => ({ answer: input }),
  };

  try {
    const result = await runAtlasAuthoritativeWorkflow({
      message: "Plan a weekend in Paris",
      memory: {},
      previousMessages: [],
      runtime,
    });
    assert.equal(result.mode, "authoritative");
    assert.equal(result.answer, answer);
    assert.equal(result.quality.passed, true);
    assert.deepEqual(calls, ["context", "plan", "retrieve", "route", "tools", "compose", "verify"]);
  } finally {
    if (previousGraph === undefined) delete process.env.ATLAS_AGENT_GRAPH_ENABLED;
    else process.env.ATLAS_AGENT_GRAPH_ENABLED = previousGraph;
  }
});

test("agent quality gate detects internal wording and duplicate hierarchy", () => {
  const quality = assessResponseQuality({
    answer: "**Food**\nGoogle did not find a Places lead.\n\n**Food**\nTry again.",
    resolved: { intent: { type: "dining_recommendations" } },
    message: "Where should I eat?",
  });
  assert.equal(quality.passed, false);
  assert.equal(quality.issueCodes.includes("INTERNAL_LANGUAGE"), true);
  assert.equal(quality.issueCodes.includes("DUPLICATE_HEADINGS"), true);
});

test("agent quality gate catches stale destinations and omitted trip constraints", () => {
  const quality = assessResponseQuality({
    answer: "Kyoto remains the focus. Here is a short general plan with museums and parks.",
    resolved: { intent: { type: "destination_planning" }, destination: "Osaka", locations: ["Osaka"] },
    memory: { destination: "Kyoto" },
    message: "Switch to Osaka for 3 days with vegetarian food.",
  });
  assert.equal(quality.issueCodes.includes("STALE_DESTINATION"), true);
  assert.equal(quality.issueCodes.includes("DIETARY_CONSTRAINT_MISSING"), true);
  assert.equal(quality.issueCodes.includes("TRIP_DURATION_MISSING"), true);
});

test("agent quality gate checks accessibility, pace, weather backup, start time and budget", () => {
  const quality = assessResponseQuality({
    answer: "Here is a general day in Helsinki with a museum and lunch.",
    resolved: {
      intent: { type: "destination_planning" },
      destination: "Helsinki",
      requestProfile: {
        constraints: {
          accessible: true,
          senior: true,
          minimalWalking: true,
          rainAlternative: true,
          startTime: "10:00",
          maxBudget: 180,
        },
      },
    },
    memory: {},
    message: "Plan the day.",
  });
  assert.equal(quality.issueCodes.includes("ACCESSIBILITY_CONSTRAINT_MISSING"), true);
  assert.equal(quality.issueCodes.includes("SENIOR_CONSTRAINT_MISSING"), true);
  assert.equal(quality.issueCodes.includes("WALKING_CONSTRAINT_MISSING"), true);
  assert.equal(quality.issueCodes.includes("WEATHER_BACKUP_MISSING"), true);
  assert.equal(quality.issueCodes.includes("START_TIME_MISSING"), true);
  assert.equal(quality.issueCodes.includes("BUDGET_CONSTRAINT_MISSING"), true);
});

test("structured response renderer produces stable heading hierarchy", () => {
  const rendered = renderStructuredAtlasResponse({
    title: "A weekend in Kyoto",
    summary: "Stay central and group nearby districts.",
    sections: [
      { heading: "Day one", paragraph: "Start early.", bullets: ["Visit the eastern temples", "Eat near Gion"] },
      { heading: "Day two", paragraph: "", bullets: ["Explore Arashiyama"] },
    ],
    nextStep: "Share your travel dates for live weather.",
  });
  assert.match(rendered, /^## A weekend in Kyoto/);
  assert.match(rendered, /### Day one/);
  assert.match(rendered, /- Visit the eastern temples/);
  assert.match(rendered, /### Best next step/);
});

test("grounded itinerary renderer removes unsupported model-selected venues", () => {
  const rendered = atlasResponseModelTestUtils.renderGroundedItinerary(
    {
      title: "Kyoto in two days",
      summary: "Use verified options only.",
      days: [
        {
          day: 1,
          title: "East",
          areaLogic: "Keep the day compact.",
          stops: [
            { name: "Verified Temple", reason: "Matches the quiet-temple request." },
            { name: "Invented Palace", reason: "This must be removed." },
          ],
          food: [{ name: "Verified Vegetarian Cafe", reason: "Vegetarian option." }],
          practicalNote: "",
        },
      ],
      nextStep: "Confirm current hours.",
    },
    [
      { name: "Verified Temple", category: "activity", address: "Higashiyama Ward, Kyoto", rating: 4.7 },
      { name: "Verified Vegetarian Cafe", category: "food", address: "Higashiyama Ward, Kyoto", rating: 4.6 },
    ],
    2,
  );
  assert.match(rendered, /Verified Temple/);
  assert.match(rendered, /Verified Vegetarian Cafe/);
  assert.doesNotMatch(rendered, /Invented Palace/);
});

test("grounded itinerary renderer removes generic next steps and repetitive model reasons", () => {
  const rendered = atlasResponseModelTestUtils.renderGroundedItinerary(
    {
      title: "A quiet day",
      summary: "Keep the route compact.",
      days: [{
        day: 1,
        title: "Model area",
        areaLogic: "Model grouping",
        stops: [{ name: "Verified Temple", reason: "Unsupported descriptive claim." }],
        food: [],
        practicalNote: "Unsupported practical claim.",
      }],
      nextStep: "Review the itinerary and make any necessary adjustments.",
    },
    [{ name: "Verified Temple", category: "activity", address: "Higashiyama Ward, Kyoto", rating: 4.7 }],
    1,
    "Find a quiet temple.",
  );
  assert.match(rendered, /Keep this day around Higashiyama Ward/);
  assert.match(rendered, /Verified Temple.*Higashiyama Ward/s);
  assert.doesNotMatch(rendered, /Unsupported descriptive claim|Unsupported practical claim|Best next step/);
});

test("grounded itinerary renderer supports food-led day plans without invented activity stops", () => {
  const rendered = atlasResponseModelTestUtils.renderGroundedItinerary(
    {
      title: "Osaka street-food day",
      summary: "Keep the day compact.",
      days: [{
        day: 1,
        title: "Model title",
        areaLogic: "Model grouping",
        stops: [],
        food: [
          { name: "Verified Market", reason: "Unsupported menu claim." },
          { name: "Verified Restaurant", reason: "Unsupported price claim." },
        ],
        practicalNote: "Unsupported practical claim.",
      }],
      nextStep: "Enjoy your trip!",
    },
    [
      { name: "Verified Market", category: "food", address: "Chuo Ward, Osaka", rating: 4.4 },
      { name: "Verified Restaurant", category: "food", address: "Chuo Ward, Osaka", rating: 4.5 },
    ],
    1,
    "Plan one relaxed day around street food and an easy evening.",
  );
  assert.match(rendered, /### Day 1: Chuo Ward/);
  assert.match(rendered, /Verified Market/);
  assert.match(rendered, /Verified Restaurant/);
  assert.match(rendered, /Keep the evening flexible/);
  assert.doesNotMatch(rendered, /Unsupported menu claim|Unsupported price claim|Best next step/);
});

test("grounded itinerary follow-ups preserve an explicitly replaced afternoon slot", () => {
  const rendered = atlasResponseModelTestUtils.renderGroundedItinerary(
    {
      title: "Updated Helsinki day",
      summary: "Keep the same pace.",
      days: [{
        day: 1,
        title: "Centre",
        areaLogic: "",
        stops: [{ name: "Verified Sauna", reason: "" }],
        food: [{ name: "Verified Cafe", reason: "" }],
        practicalNote: "",
      }],
      nextStep: "",
    },
    [
      { name: "Verified Sauna", category: "activity", address: "Helsinki", rating: 4.5, latitude: 60.17, longitude: 24.94 },
      { name: "Verified Cafe", category: "food", address: "Helsinki", rating: 4.4, latitude: 60.171, longitude: 24.941 },
    ],
    1,
    "Replace the afternoon museum with a sauna.",
  );

  assert.match(rendered, /\*\*Lunch: Verified Cafe\*\*[\s\S]*\*\*Afternoon: Verified Sauna\*\*/);
  assert.doesNotMatch(rendered, /\*\*Start: Verified Sauna\*\*/);
});

test("grounded itinerary renderer states constraints and only claims confirmed accessibility fields", () => {
  const rendered = atlasResponseModelTestUtils.renderGroundedItinerary(
    {
      title: "Accessible Helsinki",
      summary: "A compact day.",
      days: [{
        day: 1,
        title: "Centre",
        areaLogic: "Compact",
        stops: [{ name: "Verified Museum", reason: "" }],
        food: [],
        practicalNote: "",
      }],
      nextStep: "",
    },
    [{
      name: "Verified Museum",
      category: "activity",
      address: "Helsinki",
      rating: 4.5,
      accessibility: { wheelchairAccessibleEntrance: true, wheelchairAccessibleRestroom: false },
    }],
    1,
    "Plan an accessible day for my senior mother, start after 10, keep walking minimal and stay under €180 with an indoor alternative if it rains.",
  );
  assert.match(rendered, /### Plan requirements/);
  assert.match(rendered, /Start no earlier than 10:00/);
  assert.match(rendered, /step-free access/);
  assert.match(rendered, /short walking segments/);
  assert.match(rendered, /within €180/);
  assert.match(rendered, /step-free entrance/);
  assert.doesNotMatch(rendered, /accessible toilet/);
});

test("grounded itinerary renderer trims unrequested accessibility detail and enforces a stop cap", () => {
  const rendered = atlasResponseModelTestUtils.renderGroundedItinerary(
    {
      title: "Abu Dhabi plan",
      summary: "Keep the afternoon calm.",
      days: [{
        day: 1,
        title: "Saadiyat",
        areaLogic: "",
        stops: [
          { name: "Louvre Abu Dhabi", reason: "" },
          { name: "Natural History Museum", reason: "" },
          { name: "Third Museum", reason: "" },
        ],
        food: [{ name: "Museum Cafe", reason: "" }],
        practicalNote: "",
      }],
      nextStep: "",
    },
    [
      { name: "Louvre Abu Dhabi", category: "activity", address: "Saadiyat, Abu Dhabi", rating: 4.7, latitude: 24.53, longitude: 54.40, accessibility: { wheelchairAccessibleEntrance: true } },
      { name: "Natural History Museum", category: "activity", address: "Saadiyat, Abu Dhabi", rating: 4.8, latitude: 24.531, longitude: 54.401 },
      { name: "Third Museum", category: "activity", address: "Saadiyat, Abu Dhabi", rating: 4.6, latitude: 24.532, longitude: 54.402 },
      { name: "Museum Cafe", category: "food", address: "Saadiyat, Abu Dhabi", rating: 4.4, latitude: 24.533, longitude: 54.403 },
    ],
    1,
    "Build one calm afternoon there, ending before 19:00, with no more than two stops.",
  );

  assert.match(rendered, /^## Abu Dhabi · 1-day plan/);
  assert.match(rendered, /Finish by 19:00/);
  assert.match(rendered, /Use no more than 2 stops/);
  assert.match(rendered, /Louvre Abu Dhabi/);
  assert.match(rendered, /Natural History Museum/);
  assert.doesNotMatch(rendered, /Third Museum|Museum Cafe|accessible route|step-free entrance/);
});

test("itinerary map actions are limited to places named in the final answer", () => {
  const filtered = chatController._test.filterLiveActionsForAnswer(
    [
      ...Array.from({ length: 9 }, (_, index) => ({
        name: `Unrelated Park ${index + 1}`,
        url: `https://maps.example/unrelated-${index + 1}`,
      })),
      { name: "Selected Temple", url: "https://maps.example/selected" },
    ],
    "### Day 1\n- **Selected Temple**",
    { intent: { type: "destination_planning" } },
    "Build a 2 day itinerary with minimal backtracking.",
  );
  assert.deepEqual(filtered.map((item) => item.name), ["Selected Temple"]);
});

test("complex itinerary constraints survive a relevant follow-up and exclusions remove stale activities", () => {
  const first = contextService.resolveContext(
    "Plan an accessible day in Helsinki tomorrow for me and my 72-year-old mother. Start after 10, keep walking minimal, include vegetarian lunch, and give an indoor alternative if it rains.",
    { locations: [], interests: [], travelDates: [] },
    [],
  );
  assert.equal(first.intent.type, "destination_planning");
  assert.deepEqual(first.requestProfile.constraints, {
    accessible: true,
    senior: true,
    minimalWalking: true,
    indoorAlternative: true,
    rainAlternative: true,
    dietary: ["vegetarian"],
    startTime: "10:00",
  });
  assert.match(first.memory.targetDate, /^\d{4}-\d{2}-\d{2}$/);

  const sauna = contextService.resolveContext(
    "Make it a whole day and add a quiet public sauna. Keep the total under €180.",
    first.memory,
    [],
  );
  assert.equal(sauna.intent.type, "destination_planning");
  assert.equal(sauna.destination, "helsinki");
  assert.equal(sauna.activityRequest.activity, "sauna");
  assert.equal(sauna.requestProfile.constraints.maxBudget, 180);
  assert.equal(sauna.dateContext.iso, first.memory.targetDate);

  const switched = contextService.resolveContext(
    "Switch to Tallinn with the same requirements, skip the sauna and focus on the old town.",
    sauna.memory,
    [],
  );
  assert.equal(switched.destination, "tallinn");
  assert.deepEqual(switched.locations, ["tallinn"]);
  assert.equal(switched.requestProfile.constraints.accessible, true);
  assert.equal(switched.requestProfile.constraints.focus, "old town");
  assert.equal(switched.dateContext.iso, first.memory.targetDate);
  assert.equal(switched.memory.interests.includes("sauna"), false);
  assert.equal(switched.activityRequest, null);
  assert.equal(switched.currentUserMessage, "Switch to Tallinn with the same requirements, skip the sauna and focus on the old town.");
  assert.equal(
    chatController._test.isBudgetDietRefinement(
      "Make it a concise one-day old-town plan with the same vegetarian requirements.",
      switched,
    ),
    false,
  );
});

test("deterministic destination fallback keeps inherited itinerary requirements visible", () => {
  const lines = chatController._test.destinationConstraintLines({
    requestProfile: {
      constraints: {
        focus: "old town",
        accessible: true,
        senior: true,
        minimalWalking: true,
        rainAlternative: true,
        maxBudget: 180,
        currency: "EUR",
        dietary: ["vegetarian"],
        startTime: "10:00",
      },
    },
  }).join("\n");

  assert.match(lines, /old town/);
  assert.match(lines, /10:00/);
  assert.match(lines, /step-free access/);
  assert.match(lines, /senior-friendly/);
  assert.match(lines, /short walking/);
  assert.match(lines, /indoor or covered/);
  assert.match(lines, /€180/);
  assert.match(lines, /vegetarian/);
});

test("one-day duration persists across same-plan follow-ups", () => {
  const first = contextService.resolveContext(
    "Build a one-day plan for Tallinn old town with minimal walking.",
    {},
    [],
  );
  const followUp = contextService.resolveContext(
    "Keep the same plan but add a named indoor rain backup.",
    first.memory,
    [],
  );

  assert.equal(first.requestProfile.constraints.dayCount, 1);
  assert.equal(followUp.requestProfile.constraints.dayCount, 1);
  assert.equal(chatController._test.destinationConstraintLines(followUp).includes("Keep this to 1 day."), true);
});

test("deterministic destination fallback names an evidence-backed indoor rain alternative", () => {
  const answer = chatController._test.composeDestinationPipelineAnswer(
    {
      intent: { type: "destination_planning", isFollowUp: true },
      currentUserMessage: "Give me a one-day plan with a named indoor rain backup.",
      enrichedUserMessage: "Give me a one-day plan with a named indoor rain backup.",
      destination: "Tallinn",
      locations: ["Tallinn"],
      locationScope: "city",
      memory: { destination: "Tallinn", locations: ["Tallinn"], interests: [] },
      requestProfile: { constraints: { indoorAlternative: true, rainAlternative: true } },
    },
    [{
      tool: "local_experiences_and_attractions",
      result: {
        location: "Tallinn",
        recommendations: [
          { name: "Verified City Museum", category: "museum", address: "Tallinn", rating: 4.6 },
          { name: "Outdoor Viewpoint", category: "tourist_attraction", address: "Tallinn", rating: 4.8 },
        ],
      },
    }],
  );

  assert.match(answer, /\*\*Rain backup\*\*/);
  assert.match(answer, /Use Verified City Museum as the named indoor alternative/);
  assert.doesNotMatch(answer, /Use Outdoor Viewpoint as the named indoor alternative/);
});

test("deterministic destination fallback honors afternoon timing and a total stop cap", () => {
  const answer = chatController._test.composeDestinationPipelineAnswer(
    {
      intent: { type: "destination_planning", isFollowUp: true },
      currentUserMessage: "Actually, just build one calm afternoon there, ending before 19:00, with no more than two stops.",
      enrichedUserMessage: "Continue in Abu Dhabi with museums and architecture.",
      destination: "Abu Dhabi",
      locations: ["Abu Dhabi"],
      locationScope: "city",
      memory: { destination: "Abu Dhabi", locations: ["Abu Dhabi"], interests: ["museums", "architecture"] },
      requestProfile: { constraints: { dayCount: 1, endTime: "19:00", maxStops: 2 } },
    },
    [
      {
        tool: "local_experiences_and_attractions",
        result: {
          location: "Abu Dhabi",
          recommendations: [
            { name: "Louvre Abu Dhabi", address: "Saadiyat", rating: 4.7, open_now: true },
            { name: "Natural History Museum Abu Dhabi", address: "Saadiyat", rating: 4.8, open_now: true },
            { name: "Third Museum", address: "Saadiyat", rating: 4.6, open_now: true },
          ],
        },
      },
      {
        tool: "cultural_and_travel_insights",
        result: {
          practical_tips: [
            "Dress modestly in malls, government sites and religious/cultural places",
            "Public behaviour and alcohol rules are stricter than in many Western destinations",
          ],
        },
      },
    ],
  );

  assert.match(answer, /Abu Dhabi is the UAE capital/);
  assert.doesNotMatch(answer, /Dubai is best for skyline/);
  assert.match(answer, /Finish by 19:00/);
  assert.match(answer, /Use no more than 2 named stops/);
  assert.match(answer, /\*\*Afternoon flow\*\*/);
  assert.match(answer, /Afternoon: begin with Louvre Abu Dhabi/);
  assert.match(answer, /Then: add Natural History Museum Abu Dhabi/);
  assert.doesNotMatch(answer, /\*\*Local planning\*\*|Third Museum|Morning:|open now|accessible routes|Practical travel notes/);
});

test("customs requests use travel roles and never inherit itinerary constraints or tools", () => {
  const message = "I am flying from Kathmandu to Helsinki via Doha with insulin, homemade dried meat, €12,000 cash and two power banks. What must I declare or leave behind?";
  const resolved = contextService.resolveContext(
    message,
    {
      destination: "Tallinn",
      locations: ["Tallinn"],
      interests: ["sauna"],
      travelDates: [],
      constraints: { accessible: true, maxBudget: 180, currency: "EUR" },
    },
    [],
  );
  assert.equal(resolved.intent.type, "travel_logistics");
  assert.equal(resolved.destination, "Helsinki");
  assert.deepEqual(resolved.travelRoles, { origin: "Kathmandu", destination: "Helsinki", transit: ["Doha"] });
  assert.deepEqual(resolved.requestProfile.constraints, {});
  assert.deepEqual(chatController._test.relevantToolNames(resolved.intent.type, resolved.locations, false, resolved), []);

  const answer = chatController._test.composeCustomsPackingAnswer(message, resolved);
  assert.match(answer, /12,000 EUR meets the EU declaration threshold/);
  assert.match(answer, /Do not pack the meat product/);
  assert.match(answer, /Carry insulin with documentation/);
  assert.match(answer, /You listed 2/);
  assert.match(answer, /Finnish Customs/);
  assert.doesNotMatch(answer, /Tallinn|sauna/);
});

test("route parsing removes mode and timing phrases from endpoints", () => {
  const route = contextService.extractRouteRequest(
    "How do I get from Narita Airport to Shinjuku by train tomorrow at 09:30?",
  );
  assert.deepEqual(route, {
    origin: "Narita Airport",
    destination: "Shinjuku",
    mode: "train",
    departureTime: "09:30",
    dateLabel: "tomorrow",
    targetDate: route.targetDate,
  });
  assert.match(route.targetDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("focused legal and weather responses do not show unrelated map cards", () => {
  const actions = [{ name: "Old venue", url: "https://maps.example/old", category: "place" }];
  assert.deepEqual(
    chatController._test.filterLiveActionsForAnswer(
      actions,
      "Check the official destination customs authority.",
      { intent: { type: "travel_logistics" }, requestProfile: { customs: true } },
      "Can I bring medicine?",
    ),
    [],
  );
  assert.deepEqual(
    chatController._test.filterLiveActionsForAnswer(
      actions,
      "Rain is expected this afternoon.",
      { intent: { type: "weather_inquiry" } },
      "Will it rain?",
    ),
    [],
  );
  assert.deepEqual(
    chatController._test.filterLiveActionsForAnswer(
      actions,
      "ATLAS sees a red-flag safety context.",
      { intent: { type: "safety_inquiry" } },
      "Give me a safety-only assessment.",
    ),
    [],
  );
});

test("future activity answers qualify unverified venue traits and scope weather to the requested window", () => {
  const answer = chatController._test.composeActivityAnswer(
    {
      enrichedUserMessage: "Indoor public tennis tomorrow evening",
      destination: "Riihimäki",
      activityRequest: { activity: "tennis", activityLabel: "tennis" },
      dateContext: { label: "tomorrow evening", targetDate: "2026-07-28" },
      memory: { interests: ["tennis"] },
    },
    [
      {
        tool: "local_experiences_and_attractions",
        result: {
          location: "Riihimäki, Finland",
          experience_category: "tennis",
          recommendations: [{ name: "Example Sports Hall", open_now: true, address: "Centre" }],
        },
      },
      {
        tool: "comprehensive_weather_analysis",
        result: {
          location: "Riihimäki, Finland",
          current_conditions: { description: "rain", temperature: 13, feels_like: 12, wind_speed: 10 },
          forecast_scope: { target_label: "tomorrow evening", target_date: "2026-07-28" },
          hourly_forecast: [
            { time: "Tue 28 Jul, 09:00", temperature: 16, description: "cloudy", rain_probability: 20, wind_speed: 8 },
            { time: "Tue 28 Jul, 18:00", temperature: 13, description: "rain", rain_probability: 90, wind_speed: 12 },
            { time: "Tue 28 Jul, 21:00", temperature: 12, description: "rain", rain_probability: 80, wind_speed: 9 },
          ],
        },
      },
    ],
  );

  assert.match(answer, /does not confirm indoor courts and public access or low pricing/i);
  assert.doesNotMatch(answer, /open now/i);
  assert.doesNotMatch(answer, /09:00/);
  assert.match(answer, /18:00/);
  assert.match(answer, /21:00/);
});

test("activity ranking follow-ups return only the requested shortlist and omit weather", () => {
  const answer = chatController._test.composeActivityAnswer(
    {
      intent: { type: "activity_recommendations", selectionFollowUp: true },
      currentUserMessage: "Which are most likely indoors? Do not repeat the weather; rank the best two.",
      enrichedUserMessage: "Which are most likely indoors? Do not repeat the weather; rank the best two.",
      destination: "Riihimäki",
      activityRequest: { activity: "tennis", activityLabel: "tennis" },
      memory: { interests: ["tennis"] },
      requestProfile: { constraints: {} },
    },
    [{
      tool: "local_experiences_and_attractions",
      result: {
        location: "Riihimäki, Finland",
        recommendations: [
          { name: "Example Sports Hall", address: "Centre", rating: 4.4 },
          { name: "Outdoor Tennis Court", address: "Park", rating: 4.8 },
          { name: "Community Arena", address: "North", rating: 4.1 },
        ],
      },
    }],
  );

  assert.match(answer, /Best 2 tennis options/i);
  assert.match(answer, /Example Sports Hall/);
  assert.match(answer, /Community Arena/);
  assert.doesNotMatch(answer, /Outdoor Tennis Court/);
  assert.doesNotMatch(answer, /Weather timing/);
});

test("destination planning does not request accommodation excluded from the trip scope", () => {
  const resolved = contextService.resolveContext(
    "Plan four days in Lisbon with a €900 ground budget excluding flights and hotel. Include architecture, food and viewpoints.",
    {},
    [],
  );
  const tools = chatController._test.relevantToolNames(resolved.intent.type, resolved.locations, false, resolved);

  assert.equal(resolved.intent.type, "destination_planning");
  assert.equal(tools.includes("smart_accommodation_finder"), false);
  assert.equal(tools.includes("local_experiences_and_attractions"), true);
  assert.equal(tools.includes("intelligent_restaurant_discovery"), true);
});

test("focused safety composition excludes unrelated destination sections", () => {
  const answer = chatController._test.composeDestinationPipelineAnswer(
    {
      intent: { type: "safety_inquiry" },
      destination: "Iran",
      locations: ["Iran"],
      locationScope: "country",
      currentUserMessage: "Give me a concise safety assessment.",
      enrichedUserMessage: "Give me a concise safety assessment.",
      requestProfile: { constraints: {} },
    },
    [{
      tool: "comprehensive_safety_intelligence",
      result: {
        safety_assessment: {
          caution_score: 95,
          caution_label: "Red-flag / avoid or defer unless essential",
          caution_drivers: ["official advisory includes against-all-travel language"],
          coverage_confidence: "medium",
          checked_at: "2026-07-28T10:00:00.000Z",
        },
        official_advisory: {
          source: "Official authority",
          title: "Iran travel advice",
          url: "https://example.test/iran",
        },
      },
    }],
  );

  assert.match(answer, /Safety check: Iran/);
  assert.match(answer, /Defer non-essential travel/);
  assert.doesNotMatch(answer, /Food|Where to stay|Weather|Best next step/);
});

test("dining composition honors result counts, dietary labels and future timing", () => {
  const answer = chatController._test.composeDiningAnswer(
    {
      currentUserMessage: "Find four vegetarian dinner options tonight after 21:00 under ¥4,000 per person.",
      enrichedUserMessage: "Find four vegetarian dinner options tonight after 21:00 under ¥4,000 per person.",
      destination: "Tokyo",
      requestProfile: { constraints: { dietary: ["vegetarian"], maxBudget: 4000, currency: "JPY" } },
      memory: {},
    },
    [{
      tool: "intelligent_restaurant_discovery",
      result: {
        location: "Tokyo",
        restaurants: Array.from({ length: 5 }, (_, index) => ({
          name: `Vegetarian Option ${index + 1}`,
          open_now: true,
        })),
      },
    }],
  );

  assert.match(answer, /Vegetarian restaurants in Tokyo/);
  assert.match(answer, /Vegetarian Option 4/);
  assert.doesNotMatch(answer, /Vegetarian Option 5/);
  assert.doesNotMatch(answer, /open now/);
  assert.match(answer, /did not verify that every option stays under JPY 4,000/);
});

test("route fallback does not claim a route was verified when providers return no route", () => {
  const answer = chatController._test.composeRouteAnswer(
    {
      routeRequest: { origin: "Narita Airport", destination: "Shinjuku", mode: "transit" },
    },
    [{
      tool: "route_and_transport_planner",
      result: {
        origin: "Narita Airport",
        destination: "Shinjuku",
        mode: "transit",
        routes: [],
        practical_tips: ["Check live departures."],
      },
    }],
  );

  assert.match(answer, /could not verify step-by-step transit data/i);
  assert.doesNotMatch(answer, /ATLAS checked this as/i);
});

test("destination weather timing respects a requested itinerary start time", () => {
  const lines = chatController._test.weatherTimingLines(
    {
      location: "Tallinn",
      current_conditions: { description: "rain", temperature: 18, feels_like: 18, wind_speed: 10 },
      hourly_forecast: [
        { time: "Tue 28 Jul, 06:00", temperature: 15, description: "cloudy", rain_probability: 10 },
        { time: "Tue 28 Jul, 09:00", temperature: 17, description: "cloudy", rain_probability: 20 },
        { time: "Tue 28 Jul, 12:00", temperature: 19, description: "rain", rain_probability: 70 },
        { time: "Tue 28 Jul, 15:00", temperature: 18, description: "rain", rain_probability: 80 },
      ],
    },
    "Tallinn",
    ["Tallinn"],
    false,
    false,
    { startTime: "10:00" },
  ).join("\n");

  assert.doesNotMatch(lines, /06:00|09:00/);
  assert.match(lines, /12:00/);
  assert.match(lines, /15:00/);
});

test("authoritative canary assignment is deterministic", () => {
  const previous = {
    graph: process.env.ATLAS_AGENT_GRAPH_ENABLED,
    percent: process.env.ATLAS_AGENT_CANARY_PERCENT,
  };
  try {
    process.env.ATLAS_AGENT_GRAPH_ENABLED = "true";
    process.env.ATLAS_AGENT_CANARY_PERCENT = "100";
    assert.equal(shouldUseAtlasAuthoritativeGraph("user-a"), true);
    process.env.ATLAS_AGENT_CANARY_PERCENT = "0";
    assert.equal(shouldUseAtlasAuthoritativeGraph("user-a"), false);
  } finally {
    if (previous.graph === undefined) delete process.env.ATLAS_AGENT_GRAPH_ENABLED;
    else process.env.ATLAS_AGENT_GRAPH_ENABLED = previous.graph;
    if (previous.percent === undefined) delete process.env.ATLAS_AGENT_CANARY_PERCENT;
    else process.env.ATLAS_AGENT_CANARY_PERCENT = previous.percent;
  }
});

import { z } from "zod";
import { runWithoutAutomaticTracing } from "../monitoring/atlasTracing.js";
import { invokeStructuredGroq } from "../../services/groqModelService.js";

const ResponseSectionSchema = z.object({
  heading: z.string().min(2).max(80),
  paragraph: z.string().max(900),
  bullets: z.array(z.string().min(2).max(500)).max(7),
});

const AtlasResponseSchema = z.object({
  title: z.string().min(2).max(100),
  summary: z.string().min(2).max(900),
  sections: z.array(ResponseSectionSchema).min(1).max(7),
  nextStep: z.string().max(350),
});

const ItineraryEntrySchema = z.object({
  name: z.string().min(2).max(180),
  reason: z.string().max(350),
});

const ItineraryDaySchema = z.object({
  day: z.number().int().min(1).max(7),
  title: z.string().min(2).max(80),
  areaLogic: z.string().min(2).max(500),
  stops: z.array(ItineraryEntrySchema).max(4),
  food: z.array(ItineraryEntrySchema).max(2),
  practicalNote: z.string().max(300),
});

const GroundedItinerarySchema = z.object({
  title: z.string().min(2).max(100),
  summary: z.string().min(2).max(700),
  days: z.array(ItineraryDaySchema).min(1).max(7),
  nextStep: z.string().max(300),
});

function normalizeLine(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:#{1,6}|[-*•])\s*/, "")
    .trim();
}

export function renderStructuredAtlasResponse(response = {}) {
  const title = normalizeLine(response.title || "ATLAS travel guidance");
  const summary = String(response.summary || "").trim();
  const sections = Array.isArray(response.sections) ? response.sections : [];
  const blocks = [`## ${title}`, summary];

  for (const section of sections) {
    const heading = normalizeLine(section?.heading);
    const paragraph = String(section?.paragraph || "").trim();
    const bullets = Array.isArray(section?.bullets)
      ? section.bullets.map(normalizeLine).filter(Boolean).slice(0, 7)
      : [];
    if (!heading || (!paragraph && !bullets.length)) continue;
    if (summary && /^(?:introduction|overview|about this plan)$/i.test(heading)) continue;
    blocks.push(`### ${heading}`);
    if (paragraph) blocks.push(paragraph);
    if (bullets.length) blocks.push(bullets.map((item) => `- ${item}`).join("\n"));
  }

  const nextStep = String(response.nextStep || "").trim();
  if (nextStep) blocks.push(`### Best next step\n${nextStep}`);
  return blocks.filter(Boolean).join("\n\n");
}

function normalizedName(value = "") {
  return normalizeLine(value).toLocaleLowerCase("en");
}

function addressArea(address = "") {
  const text = String(address || "");
  const ward = text.match(/\b([A-Za-zÀ-ž' -]+ Ward)\b/i)?.[1];
  if (ward) return normalizeLine(ward);
  const district = text.split(",").map((part) => part.trim()).find((part) => /\b(district|quarter|borough|neighbou?rhood)\b/i.test(part));
  if (district) return normalizeLine(district);
  const postalLocality = text.split(",").map((part) => part.trim()).find((part) => /^\d{4,6}\s+\p{L}/u.test(part));
  return normalizeLine(postalLocality || "");
}

function placeDistanceKm(first = {}, second = {}) {
  const lat1 = Number(first.latitude);
  const lon1 = Number(first.longitude);
  const lat2 = Number(second.latitude);
  const lon2 = Number(second.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const radians = (value) => value * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function usefulItineraryNextStep(value = "") {
  const nextStep = String(value || "").trim();
  if (!nextStep) return "";
  if (/\b(?:review (?:the )?itinerary|make (?:any )?necessary adjustments|finali[sz]e (?:the )?plan|enjoy (?:your|the)|have a (?:great|good|wonderful)|book\b[\s\S]{0,80}\b(?:in advance|to ensure))\b/i.test(nextStep)) {
    return "";
  }
  return nextStep;
}

function requestedDayCount(userMessage = "") {
  const text = String(userMessage || "");
  if (/\b(?:half[-\s]?day|morning|afternoon|evening)\s+(?:plan|itinerary)\b|\b(?:plan|itinerary|build|create)\b[\s\S]{0,48}\b(?:morning|afternoon|evening)\b|\b(?:just|only|one)\b[\s\S]{0,32}\b(?:morning|afternoon|evening)\b/i.test(text)) return 1;
  const stored = Number(text.match(/"dayCount"\s*:\s*(\d{1,2})/i)?.[1]);
  if (Number.isFinite(stored) && stored > 0 && stored <= 31) return stored;
  const numeric = text.match(/\b(\d{1,2})(?:\s+\w+){0,3}\s+days?\b/i)?.[1];
  if (numeric && Number(numeric) <= 31) return Number(numeric);
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14 };
  const word = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)(?:\s+\w+){0,3}\s+days?\b/i)?.[1]?.toLowerCase();
  return words[word] || 0;
}

function requestedStopCount(userMessage = "") {
  const text = String(userMessage || "");
  const token = text.match(/\b(?:no more than|up to|maximum|max)\s+(\d+|one|two|three|four|five)\s+stops?\b/i)?.[1]
    || text.match(/"maxStops"\s*:\s*(\d+)/i)?.[1];
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const count = words[String(token || "").toLowerCase()] || Number(token);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function requestRequirementLines(userMessage = "") {
  const text = String(userMessage || "");
  const normalized = text.toLowerCase();
  const lines = [];
  const accessible = /\b(accessible|accessibility|wheelchair|step[-\s]?free|mobility)\b/i.test(text)
    || /"accessible"\s*:\s*true/i.test(text);
  const senior = /\b(senior|elderly|older (?:adult|parent|mother|father)|\d{2,3}[-\s]?year[-\s]?old)\b/i.test(text)
    || /"senior"\s*:\s*true/i.test(text);
  const minimalWalking = /\b(minimal|little|less|limited|avoid)\s+walking\b|\bwalking\s+(?:as little as possible|limit|minimal|limited)\b/i.test(text)
    || /\b(knee|ankle|hip|leg)\s+(?:injury|pain|problem)|\b(?:moderate|gentle)\s+walking\b|\bfrequent\s+(?:rest|seating)|\brest\s+stops?\b/i.test(text)
    || /"minimalWalking"\s*:\s*true/i.test(text);
  const minimalTransfers = /\b(minimal|few|fewer|avoid)\s+transfers?\b|\btransfers?\s+(?:as little as possible|minimal|limited)\b/i.test(text)
    || /"minimalTransfers"\s*:\s*true/i.test(text);
  const rainAlternative = /\b(if it rains|rainy\s+day|rain(?:y)?\s+(?:alternative|option|backup)|wet[-\s]?weather|indoor alternative)\b/i.test(text)
    || /"(?:rainAlternative|indoorAlternative)"\s*:\s*true/i.test(text);
  const startTime = text.match(/\b(?:(?:start|starting)\s+)?(?:after|from)\s+(\d{1,2}(?::\d{2})?)\b/i)?.[1]
    || text.match(/\b(?:start|starting)\s+at\s+(\d{1,2}(?::\d{2})?)\b/i)?.[1]
    || text.match(/"startTime"\s*:\s*"([^"]+)"/i)?.[1];
  const endTime = text.match(/\b(?:until|to|before)\s+(\d{1,2}(?::\d{2})?)\b/i)?.[1]
    || text.match(/"endTime"\s*:\s*"([^"]+)"/i)?.[1];
  const writtenBudget = text.match(/\b(?:under|below|maximum|max(?:imum)?|up to|budget(?:\s+of)?)\s*([€$£¥]|EUR|USD|GBP|JPY)?\s*([\d,.]+)/i)
    || text.match(/([€$£¥])\s*([\d,.]+)/i);
  const storedBudget = text.match(/"maxBudget"\s*:\s*([\d.]+)/i);
  const exclusions = [...text.matchAll(/\b(?:skip|exclude|avoid|without|no(?!\s+more\s+than))\s+(?:the\s+)?([a-z][a-z -]{1,28}?)(?=\s+(?:and|but|while|with|for|to|focus)\b|[,.!?]|$)/gi)]
    .map((match) => normalizeLine(match[1]))
    .filter(Boolean);

  if (startTime && endTime) lines.push(`Use the requested window ${startTime.includes(":") ? startTime : `${startTime}:00`}–${endTime.includes(":") ? endTime : `${endTime}:00`}.`);
  else if (startTime) lines.push(`Start no earlier than ${startTime.includes(":") ? startTime : `${startTime}:00`}.`);
  else if (endTime) lines.push(`Finish by ${endTime.includes(":") ? endTime : `${endTime}:00`}.`);
  if (accessible || senior || minimalWalking) {
    const needs = [
      accessible ? "step-free access" : "",
      senior ? "senior-friendly pacing and rest opportunities" : "",
      minimalWalking ? "short walking segments" : "",
    ].filter(Boolean).join(", ");
    lines.push(`Prioritize ${needs}. Accessibility is only confirmed where the live place record states it; verify entrances, lifts, toilets and seating directly.`);
  }
  if (minimalTransfers) lines.push("Prefer direct transport or the fewest practical transfers; verify step-free interchanges before leaving.");
  const maxStopsToken = text.match(/\b(?:no more than|up to|maximum|max)\s+(\d+|one|two|three|four|five)\s+stops?\b/i)?.[1]
    || text.match(/"maxStops"\s*:\s*(\d+)/i)?.[1];
  const maxStopWords = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const maxStops = maxStopWords[String(maxStopsToken || "").toLowerCase()] || Number(maxStopsToken);
  if (Number.isFinite(maxStops) && maxStops > 0) lines.push(`Use no more than ${maxStops} stops.`);
  if (rainAlternative) lines.push("Keep an indoor or covered alternative for poor weather.");
  if (writtenBudget || storedBudget) {
    const symbol = writtenBudget?.[1] || text.match(/"currency"\s*:\s*"([^"]+)"/i)?.[1] || "";
    const amount = writtenBudget?.[2] || storedBudget?.[1];
    const formattedBudget = /^[€$£¥]$/.test(symbol)
      ? `${symbol}${amount}`
      : `${symbol ? `${symbol} ` : ""}${amount}`;
    if (amount) lines.push(`Keep the total plan within ${formattedBudget}. Check current admission, transport and meal costs before committing.`);
  }
  if (exclusions.length) lines.push(`Leave out: ${exclusions.join(", ")}.`);
  if (/\bvegetarian\b/i.test(normalized)) lines.push("Keep food vegetarian and confirm stocks, sauces and shared cooking surfaces when relevant.");
  return [...new Set(lines)].slice(0, 6);
}

function accessibilityLabel(accessibility = {}) {
  const confirmed = [
    accessibility.wheelchairAccessibleEntrance ? "step-free entrance" : "",
    accessibility.wheelchairAccessibleSeating ? "accessible seating" : "",
    accessibility.wheelchairAccessibleRestroom ? "accessible toilet" : "",
    accessibility.wheelchairAccessibleParking ? "accessible parking" : "",
  ].filter(Boolean);
  return confirmed.length ? ` · ${confirmed.join(", ")}` : "";
}

function renderGroundedItinerary(response = {}, evidencePlaces = [], requestedDays = 0, userMessage = "") {
  const evidenceMap = new Map(
    evidencePlaces
      .filter((item) => item?.name)
      .map((item) => [normalizedName(item.name), item]),
  );
  const usedStops = new Set();
  const usedFood = new Set();
  const foodEvidence = evidencePlaces.filter((item) => item.category === "food");
  const showAccessibility = /\b(accessible|accessibility|wheelchair|step[-\s]?free|mobility|senior|elderly|older adult|minimal walking|limited walking|knee|ankle|hip|leg injury)\b/i.test(userMessage)
    || /"(?:accessible|senior|minimalWalking)"\s*:\s*true/i.test(userMessage);
  let remainingNamedStops = requestedStopCount(userMessage) || Number.POSITIVE_INFINITY;
  const days = (Array.isArray(response.days) ? response.days : [])
    .sort((a, b) => Number(a.day || 0) - Number(b.day || 0))
    .slice(0, requestedDays || 7)
    .map((day) => {
      const stops = (Array.isArray(day.stops) ? day.stops : [])
        .map((entry) => ({ entry, evidence: evidenceMap.get(normalizedName(entry?.name)) }))
        .filter(({ evidence }) => {
          const key = normalizedName(evidence?.name);
          if (!evidence || evidence.category !== "activity" || usedStops.has(key)) return false;
          usedStops.add(key);
          return true;
        });
      let food = (Array.isArray(day.food) ? day.food : [])
        .map((entry) => ({ entry, evidence: evidenceMap.get(normalizedName(entry?.name)) }))
        .filter(({ evidence }) => evidence && evidence.category === "food" && !usedFood.has(normalizedName(evidence.name)));
      const referenceEvidence = stops[0]?.evidence || food[0]?.evidence || null;
      const primaryArea = addressArea(referenceEvidence?.address);
      const referenceHasCoordinates = Number.isFinite(Number(referenceEvidence?.latitude))
        && Number.isFinite(Number(referenceEvidence?.longitude));
      const compactMatch = (evidence) => {
        if (referenceHasCoordinates) {
          const distance = placeDistanceKm(referenceEvidence, evidence);
          return distance !== null && distance <= 2.5;
        }
        return Boolean(primaryArea && addressArea(evidence.address) === primaryArea);
      };
      const compactStops = referenceEvidence ? stops.filter(({ evidence }) => compactMatch(evidence)) : [];
      const candidateStops = compactStops.length ? compactStops : stops.slice(0, 1);
      const finalStops = candidateStops.slice(0, Math.max(0, remainingNamedStops));
      const remainingFoodSlots = Math.max(0, remainingNamedStops - finalStops.length);
      const sameAreaFood = referenceEvidence
        ? food.filter(({ evidence }) => compactMatch(evidence)).slice(0, Math.min(2, remainingFoodSlots))
        : food.slice(0, Math.min(2, remainingFoodSlots));
      if (primaryArea && sameAreaFood.length < Math.min(2, remainingFoodSlots)) {
        for (const evidence of foodEvidence) {
          if (
            sameAreaFood.length >= Math.min(2, remainingFoodSlots)
            || usedFood.has(normalizedName(evidence.name))
            || !compactMatch(evidence)
            || sameAreaFood.some((candidate) => normalizedName(candidate.evidence.name) === normalizedName(evidence.name))
          ) continue;
          sameAreaFood.push({ entry: { name: evidence.name, reason: `Food option in ${primaryArea}.` }, evidence });
        }
      }
      if (sameAreaFood.length) {
        food = sameAreaFood;
      } else {
        food = [];
      }
      for (const { evidence } of food) usedFood.add(normalizedName(evidence.name));
      remainingNamedStops -= finalStops.length + food.length;
      const areas = [...new Set([...finalStops, ...food].map(({ evidence }) => addressArea(evidence.address)).filter(Boolean))];
      const areaLabel = referenceHasCoordinates
        ? (primaryArea || "compact cluster")
        : areas.length === 0
        ? "compact area"
        : areas.length === 1
        ? areas[0]
        : areas.length === 2
        ? areas.join(" + ")
        : "route-check grouping";
      const areaLogic = referenceHasCoordinates
        ? `The selected stops are within about 2.5 km of the first stop; check the exact ${showAccessibility ? "accessible " : ""}route before leaving.${/\b(quiet|calm|peaceful|less crowded)\b/i.test(userMessage) ? " Crowd levels vary, so check the best visit time." : ""}`
        : areas.length <= 1
        ? `Keep this day around ${areaLabel || "one compact area"} to reduce backtracking.${/\b(quiet|calm|peaceful|less crowded)\b/i.test(userMessage) ? " Crowd levels vary, so check the best visit time." : ""}`
        : `These addresses span ${areas.join(" and ")}; verify the order in Maps before leaving.`;
      const practicalNote = !food.length && /\b(vegetarian|vegan|halal|kosher|gluten[-\s]?free|food|dining|restaurant|seafood)\b/i.test(userMessage)
        ? `ATLAS did not verify a matching food option in ${primaryArea || "this exact area"}; search near the final stop and confirm the current menu.`
        : /\b(evening|night|nightlife)\b/i.test(userMessage)
        ? "Keep the evening flexible in the same area and confirm closing times before you go."
        : "";
      return { ...day, title: areaLabel, areaLogic, stops: finalStops, food, practicalNote };
    });
  const displayedStops = new Set(days.flatMap((day) => day.stops.map(({ evidence }) => normalizedName(evidence?.name || ""))));
  const unusedActivities = evidencePlaces
    .filter((item) => item.category === "activity" && !displayedStops.has(normalizedName(item.name)))
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  for (const day of days) {
    if (day.stops.length || !unusedActivities.length || remainingNamedStops <= 0) continue;
    const foodReference = day.food[0]?.evidence || null;
    let selectedIndex = 0;
    if (foodReference) {
      const nearbyIndex = unusedActivities.findIndex((candidate) => {
        const distance = placeDistanceKm(foodReference, candidate);
        return distance !== null && distance <= 2.5;
      });
      if (nearbyIndex >= 0) selectedIndex = nearbyIndex;
    }
    const [evidence] = unusedActivities.splice(selectedIndex, 1);
    displayedStops.add(normalizedName(evidence.name));
    day.stops = [{ entry: { name: evidence.name, reason: "Evidence-backed activity stop." }, evidence }];
    remainingNamedStops -= 1;
    day.title = addressArea(evidence.address) || day.title || "compact area";
    const distanceToFood = foodReference ? placeDistanceKm(evidence, foodReference) : null;
    day.areaLogic = distanceToFood !== null && distanceToFood <= 2.5
      ? "The activity and meal are within about 2.5 km; verify a low-walking route and rest points before leaving."
      : "Use this as the day’s anchor and verify a low-walking route, rest points and any meal transfer before leaving.";
  }

  const rawTitle = normalizeLine(response.title || "ATLAS itinerary");
  const title = requestedDays > 0 && !new RegExp(`\\b${requestedDays}\\s*(?:-| )?days?\\b`, "i").test(rawTitle)
    ? `${rawTitle.replace(/\s+(?:travel\s+)?(?:plan|itinerary)$/i, "")} · ${requestedDays}-day plan`
    : rawTitle;
  const blocks = [
    `## ${title}`,
    String(response.summary || "").trim(),
  ];
  const requirements = requestRequirementLines(userMessage);
  if (requirements.length) blocks.push(`### Plan requirements\n${requirements.map((item) => `- ${item}`).join("\n")}`);
  for (const day of days) {
    blocks.push(`### Day ${day.day}: ${normalizeLine(day.title)}`);
    if (day.areaLogic) blocks.push(String(day.areaLogic).trim());
    const replacesAfternoonStop = /\b(?:replace|swap)\b[\s\S]{0,100}\bafternoon\b|\bafternoon\b[\s\S]{0,100}\b(?:replace|swap)\b/i.test(userMessage);
    const stopLabels = replacesAfternoonStop
      ? ["Afternoon", "Optional stop", "Additional stop"]
      : ["Start", "Afternoon", "Optional stop", "Additional stop"];
    const foodLabels = ["Lunch", "Meal backup"];
    const stopEntries = day.stops.map(({ evidence }, index) => {
        const context = [evidence.address, evidence.rating ? `${evidence.rating}/5` : ""].filter(Boolean).join(" · ");
        const accessibility = showAccessibility ? accessibilityLabel(evidence.accessibility) : "";
        return `- **${stopLabels[index] || "Stop"}: ${evidence.name}**${context ? ` — ${context}` : ""}${accessibility}`;
      });
    const foodEntries = day.food.map(({ evidence }, index) => {
        const context = [evidence.address, evidence.rating ? `${evidence.rating}/5` : ""].filter(Boolean).join(" · ");
        const dietaryNote = /\b(vegetarian|vegan|halal|kosher|gluten[-\s]?free)\b/i.test(userMessage)
          ? "Confirm the current menu, ingredients and cross-contact directly."
          : "Confirm the current menu directly.";
        return `- **${foodLabels[index] || "Food"}: ${evidence.name}**${context ? ` — ${context}` : ""}. ${dietaryNote}`;
      });
    const entries = replacesAfternoonStop
      ? [...foodEntries.slice(0, 1), ...stopEntries, ...foodEntries.slice(1)]
      : [
          ...stopEntries.slice(0, 1),
          ...foodEntries.slice(0, 1),
          ...stopEntries.slice(1),
          ...foodEntries.slice(1),
        ];
    if (entries.length) blocks.push(entries.join("\n"));
    if (day.practicalNote) blocks.push(`_${String(day.practicalNote).trim()}_`);
  }
  const selectedNames = days
    .flatMap((day) => [...day.stops, ...day.food])
    .map(({ evidence }) => normalizedName(evidence?.name || ""));
  if (/\btemples?\b/i.test(userMessage) && !selectedNames.some((name) => /\btemple\b/i.test(name))) {
    blocks.push("_ATLAS did not verify a temple that fit the evidence and constraints in this search. Add one only after confirming step-free access, covered rest space and the current opening time._");
  }
  const nextStep = usefulItineraryNextStep(response.nextStep);
  if (nextStep) blocks.push(`### Best next step\n${nextStep}`);
  return blocks.filter(Boolean).join("\n\n");
}

export function langChainResponseEnabled() {
  return Boolean(process.env.GROQ_API_KEY) && process.env.ATLAS_LANGCHAIN_RESPONSE_ENABLED === "true";
}

export async function generateGroundedItinerary({
  userMessage,
  destination = "",
  evidencePlaces = [],
  recentMessages = [],
  signal,
} = {}) {
  if (!langChainResponseEnabled() || !evidencePlaces.length) return null;
  const requestedDays = requestedDayCount(userMessage);
  const compactEvidence = evidencePlaces.filter((item) => item.category !== "stay").slice(0, 30).map((item) => ({
    name: String(item.name || "").slice(0, 180),
    category: item.category === "food" ? "food" : "activity",
    address: String(item.address || "").slice(0, 220),
    rating: Number(item.rating || 0) || null,
    latitude: Number(item.latitude) || null,
    longitude: Number(item.longitude) || null,
    accessibility: item.accessibility && typeof item.accessibility === "object"
      ? item.accessibility
      : null,
  }));
  const allowedNames = new Set(compactEvidence.map((item) => normalizedName(item.name)));
  const prompt = `Build the concise itinerary the user requested using only the evidence list.
- Use exactly ${requestedDays || "the appropriate number of"} day sections.
- Preserve every stated preference, dietary need, pace and transport constraint.
- Every value in stops[].name and food[].name must exactly copy a name from the evidence.
- Put restaurant evidence only in food and activity evidence only in stops.
- For a food-led day with no activity evidence, leave stops empty and build the day from food evidence.
- In each reason, explain how the option fits the user's stated preference using only its category, address and rating. Do not use generic filler such as "Activity" or "Vegetarian food".
- Do not mention any other named venue in titles, explanations, reasons or notes.
- Use address text to reduce backtracking. If the evidence does not prove two places are near each other, say the grouping needs a map check.
- Do not invent opening hours, prices, availability, history, awards, dietary suitability or travel duration.
- Do not add safety, customs, accommodation or packing advice unless explicitly requested.

Evidence:
${JSON.stringify(compactEvidence)}`;

  const response = await runWithoutAutomaticTracing(() => invokeStructuredGroq({
    role: "response",
    operation: "grounded_itinerary",
    schema: GroundedItinerarySchema,
    schemaName: "atlas_grounded_itinerary",
    messages: [
      { role: "system", content: prompt },
      ...recentMessages.slice(-4).map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || "").slice(0, 700),
      })),
      { role: "user", content: String(userMessage || "").slice(0, 3000) },
    ],
    signal,
    temperature: 0.1,
    maxTokens: 1400,
    timeout: 30000,
    invokeOptions: {
      callbacks: [],
      tags: ["atlas", "itinerary", "langchain"],
      metadata: { operation: "grounded_itinerary", graphVersion: "travel-orchestrator-v2" },
    },
  }));

  // Do not trust model-selected names. Filter every entry against the exact
  // request-scoped evidence set before user-visible rendering.
  for (const day of response.days || []) {
    day.stops = (day.stops || []).filter((entry) => allowedNames.has(normalizedName(entry.name)));
    day.food = (day.food || []).filter((entry) => allowedNames.has(normalizedName(entry.name)));
  }
  if (destination) {
    response.title = `${normalizeLine(destination)}${requestedDays ? ` in ${requestedDays} day${requestedDays === 1 ? "" : "s"}` : " plan"}`;
    response.summary = "A practical plan using only current place evidence. Confirm access, opening times, prices and reservations before going.";
  }
  return renderGroundedItinerary(response, compactEvidence, requestedDays, userMessage);
}

export async function generateStructuredAtlasResponse({
  systemPrompt,
  recentMessages = [],
  userMessage,
  toolContext = "",
  allowedPlaceNames = [],
  signal,
} = {}) {
  if (!langChainResponseEnabled()) return null;

  const allowedNames = [...new Set(allowedPlaceNames.map(normalizeLine).filter(Boolean))].slice(0, 40);
  const evidenceRules = allowedNames.length
    ? `The only named venues, properties, restaurants or attractions you may mention are:\n${allowedNames.map((name) => `- ${name}`).join("\n")}\nDo not add any other named place. If this list is too short, use an unnamed category such as "a nearby temple" instead.`
    : "Do not name a venue, property, restaurant or attraction because no named live evidence was supplied.";
  const formattingRules = `Return a concise, user-facing ATLAS answer using the required structured schema.
- Answer the current request first. Do not repeat background already covered unless it changes the recommendation.
- Use 2 to 5 useful sections for a focused request and at most 7 for a broad plan.
- Make the summary direct and do not add a separate Introduction, Overview or conclusion section.
- Keep paragraphs short and use bullets only for genuinely scannable choices or steps.
- Follow explicit counts such as "exactly three bases" exactly, and state nights or days when requested.
- Treat rail passes as a price comparison, not an automatic saving: advise comparing point-to-point fares, regional passes and the national pass for the exact route.
- Never mention tools, agents, APIs, configured sources, retrieval, model limitations or internal processing.
- Never invent live prices, availability, opening hours, routes, weather or safety facts.
- Preserve legally required attribution and source links present in the evidence.
- If evidence is incomplete, state the practical limitation naturally as ATLAS and give the safest useful next action.
- Do not add a generic packing, safety or customs section unless the user asked for it or it materially changes the trip.
- For history or geography, avoid exact founding dates and precise historical claims unless the supplied evidence supports them; prefer careful century- or era-level wording.
- Group an itinerary geographically only when the supplied address or evidence supports that grouping. Never invent opening hours, admission prices, awards, historical labels or dietary suitability.

${evidenceRules}`;

  const response = await runWithoutAutomaticTracing(() => invokeStructuredGroq({
    role: "response",
    operation: "response_composition",
    schema: AtlasResponseSchema,
    schemaName: "atlas_travel_response",
    messages: [
      { role: "system", content: `${String(systemPrompt || "")}\n\n${formattingRules}` },
      ...(toolContext ? [{ role: "system", content: String(toolContext).slice(0, 7000) }] : []),
      ...recentMessages.slice(-6).map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || "").slice(0, 900),
      })),
      { role: "user", content: String(userMessage || "").slice(0, 3000) },
    ],
    signal,
    temperature: 0.2,
    maxTokens: 1200,
    timeout: 30000,
    invokeOptions: {
      callbacks: [],
      tags: ["atlas", "response", "langchain"],
      metadata: { operation: "response_composition", graphVersion: "travel-orchestrator-v2" },
    },
  }));

  return renderStructuredAtlasResponse(response);
}

export const atlasResponseModelTestUtils = {
  AtlasResponseSchema,
  GroundedItinerarySchema,
  renderGroundedItinerary,
};

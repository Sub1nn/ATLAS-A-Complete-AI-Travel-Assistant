import axios from "axios";
import { Conversation } from "../models/Conversation.js";
import { toolService } from "../services/toolService.js";
import { contextService } from "../services/contextService.js";
import { documentService } from "../services/documentService.js";
import { getLocationData } from "../utils/locationUtils.js";
import { chatRequestSchema, validate } from "../utils/validation.js";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function sanitize(text = "") {
  return String(text || "")
    .replace(/<function\s*=\s*[^>]+>[\s\S]*?<\/function>/gi, "")
    .replace(/<tool_call[\s\S]*?>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/```(?:json|tool-use|tool_call)[\s\S]*?```/gi, "")
    .replace(/^\s*(Analysis sources used|\d+ tools? used|Tools used).*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validateInput(message) {
  if (!message || typeof message !== "string" || !message.trim()) return "Message is required";
  if (message.length > 3000) return "Message is too long";
  return null;
}

function isIdentityQuestion(message = "") {
  const text = String(message).toLowerCase().trim();
  const travelWords = [
    "travel", "travelling", "traveling", "trip", "hotel", "hotels", "weather", "food",
    "restaurant", "safe", "safety", "concern", "concerns", "destination", "visa", "flight",
    "nepal", "kathmandu", "thamel", "tokyo", "dubai", "istanbul", "pdf", "document", "summarize"
  ];
  if (travelWords.some((word) => text.includes(word))) return false;

  return [
    /\bwho are you\b/,
    /\bwhat are you\b/,
    /\bwhat is atlas\b/,
    /\btell me about atlas\b/,
    /\bwho (created|made|built|developed) you\b/,
    /\bwho is your (creator|developer)\b/,
  ].some((pattern) => pattern.test(text));
}

function identityResponse() {
  return `**About ATLAS**\n\nATLAS is a travel planning assistant designed to help with destination research, accommodation choices, weather-aware planning, safety context, dining ideas and local travel logistics.\n\nIt can also use uploaded PDF, DOCX and TXT files when you ask questions about a document. It will not claim live prices or live availability unless that data is actually available.`;
}

function isDocumentFocusedRequest(message = "", documentIds = []) {
  if (!documentIds?.length) return false;
  const text = String(message || "").toLowerCase();
  const documentTerms = [
    "pdf", "document", "file", "uploaded", "attached", "attachment", "docx", "summarize", "summarise",
    "summary", "explain this", "what is this", "what does this say", "according to", "from this", "in this"
  ];
  return documentTerms.some((term) => text.includes(term)) || text.length < 80;
}

function buildTravelSystemPrompt(resolved, docContext = "", toolResults = [], userPreferences = {}) {
  const contextLine = contextService.contextLabel(resolved.memory);
  const hasToolResults = Array.isArray(toolResults) && toolResults.length > 0;
  const qualityLines = hasToolResults
    ? toolResults
        .map((item) => {
          const quality = item?.result?.data_quality;
          if (!quality) return `- ${item.tool}: data returned; use only the fields provided.`;
          return `- ${item.tool}: ${quality.status}; ${quality.note || "use cautiously"}`;
        })
        .join("\n")
    : "- No live tool data was available for this response.";

  return `You are ATLAS, a professional travel planning assistant.

Write like a careful human travel advisor: clear, grounded, practical and calm. Continue the conversation using previous context when the user gives a short follow-up. Do not restart globally if the user is already discussing a destination.

Current conversation context: ${contextLine || "no established context yet"}.
Detected intent: ${resolved.intent.type}.
User profile preferences: ${JSON.stringify({
  travelStyle: userPreferences.travelStyle || "balanced",
  budgetLevel: userPreferences.budgetLevel || "balanced",
  preferredLanguage: userPreferences.preferredLanguage || "English",
  dietaryNeeds: userPreferences.dietaryNeeds || "",
  interests: userPreferences.interests || [],
  familyMode: Boolean(userPreferences.familyMode),
}).slice(0, 700)}.

Response rules:
- Start with the most useful answer, not a generic introduction.
- Prioritize the user's intent and compose the answer as a travel-advisor pipeline when the user asks broad destination questions: current safety context first, then weather/timing when available, then practical culture/logistics, food, attractions and next actions.
- Accommodation questions should focus on areas, stay types, realistic price ranges and booking checks. Dining questions should focus on food, restaurants, neighborhoods and hygiene. Activity questions should focus on verified venues when available and practical categories when not.
- Never expose tools, APIs, model names, token limits, backend errors, raw function calls or JSON.
- Never claim live prices, live booking availability, live table availability, exact opening hours or exact venue suitability unless the supplied data explicitly contains it.
- If venue data is limited or unavailable, do not invent exact place names. Say briefly that live venue data could not be verified and give practical categories to check.
- If Google Places returns results, you may mention the returned place names, but still remind users to check opening hours, accessibility, booking rules and recent reviews.
- Use 3 to 5 clean sections with short headings. Use bullets only when they improve scanning. Avoid brochure-like introductions such as "rich history and culture" unless it adds useful guidance. End with one useful follow-up only if needed.
- If the user asks for hourly weather and verified hourly data is present, answer with the returned hourly forecast. If verified hourly data is not present, clearly say that live hourly data is unavailable instead of guessing.
- For safety/legal/health decisions, suggest verifying official sources.
- If preferredLanguage is not English, answer in that language unless the user wrote in English and context suggests English is expected.

Data quality for this response:
${qualityLines}
${docContext ? `\nRelevant uploaded document context, if the user asks about the file:\n${docContext}` : ""}`;
}

function buildDocumentSystemPrompt(docContext = "") {
  return `You are ATLAS, but this request is primarily about an uploaded document.

Answer like ChatGPT would when a user uploads a PDF or DOCX:
- Use the uploaded document context as the main source.
- If the user asks to summarize, give a clear, professional summary of the document.
- If the user asks a specific question, answer from the document first.
- Do not redirect the user back to travel unless the document itself is travel-related or the user asks for travel planning.
- Do not say you cannot help because the topic is not travel. Document chat is allowed.
- Do not invent details that are not in the document. If the provided context is insufficient, say exactly what is missing.
- Use clean headings and concise paragraphs.
- Never expose chunks, embeddings, tools, APIs, model names, raw JSON or backend details.

Uploaded document context:
${docContext || "No readable document context was found."}`;
}

function relevantToolNames(intent, locations, documentFocused = false, resolved = {}) {
  if (documentFocused) return [];
  if (!locations?.length && !resolved.destination) return [];

  const isCountryScope = resolved.locationScope === "country" || contextService.isCountryLike?.(resolved.destination || locations?.[0] || "");
  const interests = new Set([...(resolved.memory?.interests || [])].map((item) => contextService.normalize(item)));
  const hasOutdoorInterest = [...interests].some((item) => /tennis|sport|court|hiking|outdoor|park|wildlife|baby|family|indoor/.test(item));

  const plans = {
    weather_inquiry: ["comprehensive_weather_analysis"],
    accommodation_search: ["smart_accommodation_finder"],
    dining_recommendations: ["intelligent_restaurant_discovery", "cultural_and_travel_insights"],
    safety_inquiry: ["comprehensive_safety_intelligence"],
    cultural_inquiry: ["cultural_and_travel_insights", "comprehensive_safety_intelligence"],
    activity_recommendations: ["local_experiences_and_attractions"],
    travel_logistics: ["cultural_and_travel_insights", "comprehensive_safety_intelligence"],
  };

  if (intent === "destination_planning") {
    // Country-level travel should not be geocoded into a random city. Start with safety and culture.
    // City-level travel can use the full planning pipeline: weather, safety, culture, places, food and stays.
    if (isCountryScope) return ["comprehensive_safety_intelligence", "cultural_and_travel_insights"];
    return [
      "comprehensive_weather_analysis",
      "comprehensive_safety_intelligence",
      "cultural_and_travel_insights",
      "local_experiences_and_attractions",
      "intelligent_restaurant_discovery",
      "smart_accommodation_finder",
    ];
  }

  return plans[intent] || [];
}

async function buildToolArgs(toolName, resolved) {
  const location = resolved.destination || resolved.locations?.[0];
  const isCountryScope = resolved.locationScope === "country" || contextService.isCountryLike?.(location || "");

  const interests = Array.isArray(resolved.memory?.interests) ? resolved.memory.interests : [];
  const combinedText = `${resolved.enrichedUserMessage || ""} ${interests.join(" ")}`.toLowerCase();
  const interestText = interests.length ? interests.join(" ") : "general travel experiences";
  const budget = resolved.memory?.budget || (/cheap|budget|hostel|guesthouse|affordable/i.test(combinedText) ? "budget" : "mid-range");

  // Safety and cultural tools do not need coordinates, but city-level requests still need the
  // correct country label. Resolve it when safe so NewsAPI queries become “Kathmandu Nepal”,
  // not “Kathmandu Kathmandu”. Country/region-level destinations are not geocoded here.
  async function cityCountryContext() {
    const label = contextService.canonicalDestination?.(location || resolved.destination || "destination") || contextService.titleCase(location || resolved.destination || "destination");
    if (isCountryScope || !location) return { label, country: label };
    try {
      const locData = await getLocationData(location);
      return { label: locData?.city || label, country: locData?.country || resolved.memory?.country || label };
    } catch {
      return { label, country: resolved.memory?.country || label };
    }
  }

  if (toolName === "comprehensive_safety_intelligence") {
    const { label, country } = await cityCountryContext();
    return {
      location: label,
      country,
      specific_concerns: /tourist|weekend|travel|visit/i.test(combinedText) ? "tourist travel, current safety, entry considerations" : (interestText || "ordinary traveler precautions"),
    };
  }

  if (toolName === "cultural_and_travel_insights") {
    const { label, country } = await cityCountryContext();
    return { location: label, country, insight_type: resolved.intent.type };
  }

  let locData = null;
  if (location) {
    try {
      locData = await getLocationData(location);
    } catch (error) {
      console.warn(`Location resolution skipped for "${location}": ${error.message}`);
      locData = null;
    }
  }

  const label = locData?.formatted_address || contextService.titleCase(location || "destination");
  if (!locData) return null;

  switch (toolName) {
    case "comprehensive_weather_analysis":
      return { latitude: locData.lat, longitude: locData.lon, location_name: label };
    case "smart_accommodation_finder":
      return { lat: locData.lat, lon: locData.lon, location_name: label, budget_category: budget, stay_type: /hostel/i.test(resolved.enrichedUserMessage || "") ? "hostel" : "hotel" };
    case "intelligent_restaurant_discovery":
      return { lat: locData.lat, lon: locData.lon, location_name: label, cuisine_preference: /family|baby|child|kid/.test(combinedText) ? "family friendly local" : /street|cheap|budget/.test(combinedText) ? "cheap local" : "local traditional", budget_level: budget };
    case "local_experiences_and_attractions":
      return { lat: locData.lat, lon: locData.lon, location_name: label, interest_type: /baby|child|kid|family|stroller|indoor/.test(combinedText) ? "baby-friendly family indoor" : /tennis|sport|court/.test(combinedText) ? (/free|public|municipal/.test(combinedText) ? "public free municipal tennis courts sports center" : "sports tennis court outdoor tennis club") : interestText };
    default:
      return null;
  }
}

function mapsUrlForPlace(place = {}) {
  if (place.url && /^https?:\/\//i.test(place.url)) return place.url;
  const name = String(place.name || "").trim();
  if (!name) return "";
  const address = String(place.address || place.location_context || "").trim();
  const query = encodeURIComponent([name, address].filter(Boolean).join(" "));
  const placeId = place.place_id && place.source !== "yelp" ? `&query_place_id=${encodeURIComponent(place.place_id)}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${query}${placeId}`;
}

function normalizeLivePlace(place = {}, category = "place") {
  if (!place?.name) return null;
  return {
    name: place.name,
    category,
    address: place.address || "",
    rating: place.rating || null,
    review_count: place.review_count || 0,
    price_hint: place.price_hint || "",
    open_now: typeof place.open_now === "boolean" ? place.open_now : null,
    verified: Boolean(place.verified_from_google || place.verified_from_yelp),
    source: place.source || (place.verified_from_yelp ? "yelp" : place.verified_from_google ? "google_places" : "unknown"),
    url: mapsUrlForPlace(place),
  };
}

function extractLiveActions(toolResults = []) {
  const actions = [];

  for (const item of toolResults || []) {
    const result = item?.result || {};
    const tool = item?.tool || "";

    const category = tool === "smart_accommodation_finder"
      ? "stay"
      : tool === "intelligent_restaurant_discovery"
      ? "restaurant"
      : tool === "local_experiences_and_attractions"
      ? "place"
      : "place";

    const candidates = [
      ...(Array.isArray(result.properties) ? result.properties : []),
      ...(Array.isArray(result.restaurants) ? result.restaurants : []),
      ...(Array.isArray(result.recommendations) ? result.recommendations : []),
    ];

    for (const place of candidates) {
      const normalized = normalizeLivePlace(place, category);
      if (normalized?.verified && normalized.url) actions.push(normalized);
    }

    if (Array.isArray(result.search_actions)) {
      for (const action of result.search_actions) {
        if (action?.url && action?.name) actions.push({ ...action, category: action.category || "search" });
      }
    }
  }

  const seen = new Set();
  return actions.filter((item) => {
    const key = `${item.name}|${item.address}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}


function fmtPlaceLine(place = {}, index = 0) {
  const rating = place.rating ? `, rating ${place.rating}${place.review_count ? ` (${place.review_count} reviews)` : ""}` : "";
  const open = place.open_now === true ? ", open now" : place.open_now === false ? ", may be closed now" : "";
  const price = place.price_hint && place.price_hint !== "varies" ? `, price ${place.price_hint}` : "";
  const source = place.source === "yelp" ? ", Yelp" : place.source === "google_places" ? ", Google Places" : "";
  const address = place.address ? ` — ${place.address}` : "";
  return `${index + 1}. ${place.name}${rating}${price}${open}${source}${address}`;
}

function firstResult(toolResults = [], toolName = "") {
  return toolResults.find((item) => item.tool === toolName)?.result || null;
}

function placeRows(result = {}, key = "recommendations", limit = 6) {
  const items = Array.isArray(result?.[key]) ? result[key].slice(0, limit) : [];
  return items.map((item, index) => fmtPlaceLine(item, index));
}

function locationDisplay(resolved = {}, fallback = "your destination") {
  return contextService.canonicalDestination?.(resolved.destination || resolved.locations?.[0] || fallback) ||
    contextService.titleCase(resolved.destination || resolved.locations?.[0] || fallback);
}


function displayDestinations(resolved = {}, limit = 3) {
  const values = [
    ...(Array.isArray(resolved.locations) ? resolved.locations : []),
    ...(Array.isArray(resolved.memory?.locations) ? resolved.memory.locations : []),
    resolved.destination,
  ].filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = contextService.normalize(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(contextService.canonicalDestination?.(value) || contextService.titleCase(value));
  }

  const hasCity = out.some((value) => !contextService.isCountryLike?.(value));
  const filtered = hasCity ? out.filter((value) => !contextService.isCountryLike?.(value)) : out;
  return filtered.slice(0, limit);
}

function naturalJoin(items = []) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || "your destination";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

function isSafetySensitiveDestination(destination = "") {
  return /palest|gaza|west bank|iran|iraq|israel|lebanon|syria|afghanistan|yemen/i.test(destination);
}


function destinationProfile(destination = "your destination", resolved = {}) {
  const key = contextService.normalize(destination);
  if (/riyadh|riyad/.test(key)) {
    return {
      intro: "Riyadh is Saudi Arabia’s capital and a fast-changing city with modern districts, traditional souqs, museums, desert-edge experiences and a strong car-based layout. For a weekend trip, the best plan is to group activities by area, avoid the hottest parts of the day and keep hotel location close to your main plans.",
      food: ["Kabsa or mandi for a classic Saudi rice-and-meat meal", "mutabbaq, tamees or foul for casual local food", "Arabic coffee, dates and dessert cafes for a lighter evening stop"],
      culture: ["Dress modestly in public places", "Plan around prayer times and weekend crowd patterns", "Use ride-hailing or hotel-arranged transport if you are not renting a car"],
      stay: ["Olaya / Al Olaya: practical for business hotels, malls and central movement", "King Abdullah Financial District area: modern hotels and easier access to newer districts", "Near Boulevard / entertainment areas: useful if evening activities are your priority"],
      prices: ["Budget/simple hotels: roughly $45–80/night", "Mid-range hotels: roughly $80–160/night", "Higher-end hotels: often $170+/night, depending on dates and events"],
    };
  }
  if (/saudi arabia|saudi/.test(key)) {
    return {
      intro: "Saudi Arabia can be rewarding for culture, desert landscapes, food and major city breaks, but planning depends heavily on the city. Riyadh, Jeddah, AlUla, Makkah/Medina and the Eastern Province feel very different, so choose the base city before finalising weather, hotels and daily logistics.",
      food: ["Kabsa, mandi and grilled meats are common traditional choices", "Arabic coffee and dates are part of the hospitality culture", "Large cities also have strong international dining scenes"],
      culture: ["Respect modest dress expectations", "Check rules around religious sites and photography", "Use licensed transport and keep schedule flexibility around prayer times"],
      stay: ["Riyadh for capital-city business, museums and modern districts", "Jeddah for Red Sea atmosphere and historic Al-Balad", "AlUla for heritage and desert scenery, usually requiring earlier booking"],
      prices: ["Simple hotels: often around $45–90/night", "Mid-range hotels: often around $90–180/night", "Premium hotels and event periods can rise sharply"],
    };
  }
  if (/palestin|gaza|west bank/.test(key)) {
    return {
      intro: "The Palestinian Territories need a safety-first approach rather than a normal sightseeing plan. Conditions, access routes and movement restrictions can change quickly, so the exact city or region matters before any hotel, weather or itinerary advice is useful.",
      food: ["Local food can include falafel, hummus, musakhan, maqluba and strong coffee traditions", "For any visit, choose food stops near your accommodation and transport route"],
      culture: ["Dress and behave respectfully around religious and conservative areas", "Avoid demonstrations, checkpoints and crowded political gatherings", "Keep documents and emergency contacts available offline"],
      stay: ["Only shortlist accommodation after selecting the exact city or region", "Prioritize flexible cancellation and reliable transport access", "Avoid isolated stays if movement conditions are uncertain"],
      prices: ["Do not rely on generic price ranges until the exact city and access route are known"],
    };
  }
  if (/kathmandu/.test(key)) {
    return {
      intro: "Kathmandu is Nepal’s main arrival hub and a strong base for temples, food, old-city walks, shopping and trip logistics. The best experience depends on choosing the right area, leaving buffer for traffic and checking weather close to the day.",
      food: ["Momos, dal bhat and Newari food are worth trying", "Choose busy places with recent hygiene reviews", "Thamel and Patan offer many easy dining options"],
      culture: ["Dress respectfully around temples", "Expect traffic delays", "Carry some cash for taxis, small shops and local eateries"],
      stay: ["Thamel: easiest for first-time tourists and trekking services", "Lazimpat: quieter, more hotel-focused", "Boudha or Patan: calmer cultural atmosphere"],
      prices: ["Hostel dorms: about $5–15/night", "Simple private rooms: about $15–35/night", "Mid-range hotels: about $35–80/night"],
    };
  }
  if (/pokhara/.test(key)) {
    return {
      intro: "Pokhara is usually the easier Nepal base for lakeside stays, short hikes, cafes and mountain views. Weather can affect flights, road travel and mountain visibility, so keep one flexible day if possible.",
      food: ["Lakeside cafes are convenient", "Dal bhat and momos are easy to find", "Choose places with recent reviews during rainy periods"],
      culture: ["Keep buffer time for transport", "Use Lakeside as the practical base for most short visits", "Check mountain-view timing early in the morning"],
      stay: ["Lakeside: best for restaurants, lake access and easy tourism services", "Slightly away from Lakeside: quieter and sometimes better value"],
      prices: ["Budget rooms: about $10–30/night", "Mid-range lakeside hotels: about $35–90/night", "Premium stays vary widely by view and season"],
    };
  }
  return {
    intro: `${destination} is best planned by matching the trip purpose with the right base area, timing and transport. For a short visit, choose where you will spend most of your time first, then build food, hotels and activities around that area.`,
    food: ["Try one local/traditional meal and keep one convenient backup near your stay", "Use recent reviews and hygiene comments when choosing restaurants"],
    culture: ["Respect local customs and dress expectations", "Save offline maps and your accommodation address", "Check local holidays, opening hours and transport options"],
    stay: ["Stay close to your main activities rather than choosing only the cheapest option", "Compare recent reviews, cancellation rules and final price after taxes"],
    prices: ["Budget, mid-range and premium prices vary by city and date; confirm final rates on booking platforms"],
  };
}

function destinationIntro(destination = "your destination", resolved = {}) {
  const dates = resolved.dates?.length ? ` ${resolved.dates.join(", ")}` : "";
  const multi = displayDestinations(resolved);
  if (multi.length > 1) {
    return `For ${naturalJoin(multi)}${dates ? ` around ${dates.trim()}` : ""}, I would split the plan by base city: use the first city for arrival, culture and logistics, and the second for the activities that make it special. Weather, safety and transport should be checked separately for each city.`;
  }
  return destinationProfile(destination, resolved).intro;
}

function articleBullet(article = {}) {
  const title = article.headline || "Recent item";
  const source = article.source ? ` — ${article.source}` : "";
  const date = article.published ? ` (${String(article.published).slice(0, 10)})` : "";
  const url = article.url ? ` [source](${article.url})` : "";
  return `• ${title}${source}${date}${url}`;
}

function summarizeSafetyContext(safety = {}, destination = "your destination") {
  const rawArticles = Array.isArray(safety.current_situation) ? safety.current_situation : [];
  const risk = safety.safety_assessment?.overall_risk_level || "review current advisories";
  const destinationKey = contextService.normalize(destination);
  const isSensitive = isSafetySensitiveDestination(destination);

  const articles = rawArticles
    .filter((a) => a?.headline)
    .filter((a) => !/\bRT\b|Russia Today|Free Republic|Freerepublic|Slashdot/i.test(String(a.source || "")))
    .slice(0, 3);

  if (!articles.length) {
    const tone = isSensitive
      ? `I could not verify strong targeted news from the configured feed for ${destination}. For a sensitive destination, that should not be treated as a green signal; use official advisories and local contacts before booking.`
      : `I did not find strong targeted safety news from the configured feed for ${destination}. That usually means the app should rely more on normal travel precautions and official advisories than on a headline-based signal.`;
    return [tone, `Current safety posture: ${risk}.`];
  }

  const combined = articles.map((a) => `${a.headline} ${a.summary}`).join(" ");
  const protestLike = /protest|strike|unrest|demonstration/i.test(combined);
  const conflictLike = /conflict|attack|border|war|checkpoint|violence|military|detention|closure|flotilla/i.test(combined);
  const tourismLike = /tourism|tourist|travel|airport|pilgrim|hajj|visitor|event/i.test(combined);

  let tone;
  if (isSensitive && conflictLike) {
    tone = `The current news signal for ${destination} is high-attention. The returned items point to security, movement or conflict-related issues, so I would not treat this as an ordinary tourist trip.`;
  } else if (conflictLike || protestLike) {
    tone = `The current news signal for ${destination} suggests caution rather than alarm. Keep an eye on advisories, avoid demonstrations or border-sensitive areas, and keep plans flexible.`;
  } else if (tourismLike) {
    tone = `The current news signal for ${destination} is mostly travel-context related. It is useful background, but not enough on its own for a safety decision.`;
  } else {
    tone = `The returned news for ${destination} looks like background context rather than direct tourist disruption. Normal precautions and official advisories still matter.`;
  }

  return [tone, articles.map(articleBullet).join("\n")];
}

function practicalDestinationFallback(destination = "your destination", resolved = {}) {
  const profile = destinationProfile(destination, resolved);
  const lines = [];
  if (profile.food?.length) lines.push(`Food: ${profile.food.join("; ")}.`);
  if (profile.stay?.length) lines.push(`Stay areas: ${profile.stay.join("; ")}.`);
  if (profile.prices?.length) lines.push(`Typical stay prices: ${profile.prices.join("; ")}.`);
  if (profile.culture?.length) lines.push(`Culture and logistics: ${profile.culture.join("; ")}.`);
  return lines;
}

function compactAdvisoryNote(safety = {}, destination = "your destination") {
  const links = Array.isArray(safety.official_advisory_links) ? safety.official_advisory_links.slice(0, 2) : [];
  if (!links.length) return "";
  const linked = links.map((item) => `[${item.name.replace(/ travel advisories| travel advice/gi, "")}](${item.url})`).join(" and ");
  return `For booking decisions, compare this with ${linked}; live news is useful, but official advisories should decide the final go/no-go choice.`;
}
function composeWeatherAnswer(resolved, toolResults = []) {
  const weather = firstResult(toolResults, "comprehensive_weather_analysis");
  if (!weather?.current_conditions) return "";
  const c = weather.current_conditions;
  const hourly = Array.isArray(weather.hourly_forecast) ? weather.hourly_forecast.slice(0, 6) : [];
  const interests = (resolved.memory?.interests || []).join(" ").toLowerCase();
  const isTennis = /tennis|court|sports/.test(interests + " " + (resolved.enrichedUserMessage || ""));

  const lines = [];
  lines.push(`**Current weather in ${weather.location || resolved.destination}**`);
  lines.push(`It is ${c.description || "currently reported"}, about ${c.temperature}°C and feels like ${c.feels_like}°C. Humidity is ${c.humidity}%, wind is about ${c.wind_speed} km/h, and visibility is ${c.visibility_km ?? "available"} km.`);

  if (hourly.length) {
    lines.push(`\n**Hourly forecast**`);
    lines.push(hourly.map((h) => `• ${h.time}: ${h.temperature}°C, ${h.description}, ${h.rain_probability}% chance of rain, wind ${h.wind_speed} km/h`).join("\n"));
  }

  if (isTennis) {
    const rainRisk = hourly.some((h) => Number(h.rain_probability || 0) >= 50);
    lines.push(`\n**Tennis recommendation**`);
    lines.push(rainRisk
      ? "You can still consider playing, but keep the timing flexible because rain risk appears in the forecast window. Choose the driest earlier slot if possible."
      : "It looks suitable for tennis today. Conditions appear dry in the returned forecast window, so normal outdoor precautions should be enough.");
    lines.push("Wear layers if you play later, because temperature and wind can feel cooler on an open court.");
    lines.push("\nWould you like me to look for tennis courts or sports centres nearby?");
  } else {
    lines.push(`\n**Practical planning**`);
    lines.push(weather.travel_recommendations?.best_approach || "Use the forecast to keep outdoor plans flexible.");
    if (weather.travel_recommendations?.clothing) lines.push(`Recommended clothing: ${weather.travel_recommendations.clothing}.`);
  }

  return lines.join("\n\n");
}

function composeActivityAnswer(resolved, toolResults = []) {
  const activity = firstResult(toolResults, "local_experiences_and_attractions");
  if (!activity) return "";
  const destination = activity.location || contextService.titleCase(resolved.destination || "the area");
  const text = `${resolved.enrichedUserMessage || ""} ${(resolved.memory?.interests || []).join(" ")}`.toLowerCase();
  const isTennis = /tennis|court|sports/.test(text);
  const wantFree = /free|public|municipal|cheap/.test(text);
  const recs = Array.isArray(activity.recommendations) ? activity.recommendations.slice(0, 6) : [];

  if (!recs.length) {
    if (isTennis) {
      return `**Tennis courts near ${destination}**\n\nI checked live place search for tennis-related venues, but it did not return a reliable verified shortlist for this exact request. That can happen with smaller cities, public courts, or municipal outdoor courts because they are not always listed clearly in Google Places.\n\n**Best next checks**\n• Search Google Maps for “public tennis courts ${destination}” and “tennis club ${destination}”\n• Check the city or municipality sports pages for free outdoor courts\n• Look for sports centres and local tennis clubs, then confirm whether court use is free or reservation-based\n\n**Important note**\nGoogle Places can help find venues, but it usually cannot confirm whether a tennis court is free. Confirm access, opening hours and reservation rules before going.`;
    }
    return `**Places to check in ${destination}**\n\nI could not verify live venue results for this exact request. Use this as a planning fallback rather than a confirmed live shortlist.\n\n**Practical categories**\n• Museums, libraries and indoor venues\n• Parks and outdoor spaces when weather is good\n• Cafes, shopping centres and visitor centres\n• Official tourism or municipality pages for opening hours and accessibility`;
  }

  const heading = isTennis ? (wantFree ? `Public or low-cost tennis options near ${destination}` : `Tennis courts and sports venues near ${destination}`) : `Live place suggestions for ${destination}`;
  const lines = [`**${heading}**`];
  lines.push(recs.map(fmtPlaceLine).join("\n"));
  lines.push(`\n**How to use this shortlist**`);
  if (isTennis) {
    lines.push("These are verified venue results from the configured live place sources. They can help you choose where to check first, but they do not reliably confirm whether a court is free, public, reservable or currently available. Check the venue, club or municipality page before going.");
  } else {
    lines.push(activity.planning_tips || "Check opening hours, accessibility, booking rules and recent reviews before visiting.");
  }
  return lines.join("\n\n");
}

function placeSummaryLines(result = {}, key = "recommendations", limit = 3) {
  const items = Array.isArray(result?.[key]) ? result[key].slice(0, limit) : [];
  return items.map((item) => {
    const rating = item.rating ? `, rating ${item.rating}${item.review_count ? ` (${item.review_count} reviews)` : ""}` : "";
    const open = item.open_now === true ? ", open now" : item.open_now === false ? ", may be closed now" : "";
    const address = item.address ? ` — ${item.address}` : "";
    return `• ${item.name}${rating}${open}${address}`;
  });
}


function composeDestinationPipelineAnswer(resolved, toolResults = []) {
  if (resolved.intent.type !== "destination_planning" && resolved.intent.type !== "safety_inquiry") return "";

  const safety = firstResult(toolResults, "comprehensive_safety_intelligence");
  const culture = firstResult(toolResults, "cultural_and_travel_insights");
  const weather = firstResult(toolResults, "comprehensive_weather_analysis");
  const activities = firstResult(toolResults, "local_experiences_and_attractions");
  const restaurants = firstResult(toolResults, "intelligent_restaurant_discovery");
  const stays = firstResult(toolResults, "smart_accommodation_finder");
  const destinations = displayDestinations(resolved);
  const destination = naturalJoin(destinations.length ? destinations : [locationDisplay(resolved)]);
  const primaryDestination = destinations[0] || locationDisplay(resolved);
  const isSensitive = destinations.some(isSafetySensitiveDestination) || isSafetySensitiveDestination(primaryDestination);
  const isCountryScope = resolved.locationScope === "country" || contextService.isCountryLike?.(resolved.destination || "");

  if (!safety && !culture && !weather && !activities && !restaurants && !stays) return "";

  const lines = [`**${isSensitive ? "Safety-first outlook" : "Travel outlook"}: ${destination}**`];
  lines.push(destinationIntro(primaryDestination, resolved));

  if (safety) {
    lines.push(`\n**Safety and current context**`);
    lines.push(summarizeSafetyContext(safety, destination).join("\n\n"));
    const advisoryNote = compactAdvisoryNote(safety, destination);
    if (advisoryNote) {
      lines.push(`\n**Advisory note**`);
      lines.push(advisoryNote);
    }
  }

  if (weather?.current_conditions && !isCountryScope) {
    const c = weather.current_conditions;
    lines.push(`\n**Weather and timing**`);
    lines.push(`Current conditions for ${weather.location || primaryDestination}: ${c.description}, about ${c.temperature}°C, feels like ${c.feels_like}°C, wind ${c.wind_speed} km/h.`);
    const hourly = Array.isArray(weather.hourly_forecast) ? weather.hourly_forecast.slice(0, 4) : [];
    if (hourly.length) lines.push(hourly.map((h) => `• ${h.time}: ${h.temperature}°C, ${h.description}, ${h.rain_probability}% chance of rain`).join("\n"));
  } else if (isCountryScope) {
    lines.push(`\n**Weather and timing**`);
    if (isSensitive) {
      lines.push(`For ${destination}, weather is not the main planning risk until you choose the exact city or region. Decide the route first, then check city-level weather, road conditions and access restrictions.`);
    } else {
      lines.push(`Weather can vary strongly across ${destination}, so choose the base city first. Once you share the city, I can check a more useful live forecast instead of giving a broad country-level guess.`);
    }
  }

  const activityLines = placeSummaryLines(activities, "recommendations", 3);
  const restaurantLines = placeSummaryLines(restaurants, "restaurants", 3);
  const stayLines = placeSummaryLines(stays, "properties", 3);
  const profile = destinationProfile(primaryDestination, resolved);

  lines.push(`\n**Food, stays and local experience**`);
  if (isSensitive && isCountryScope) {
    lines.push(`For ${destination}, I would not choose hotels or sightseeing only from generic recommendations. Pick the exact city or region first, then compare accommodation near safer transport routes with flexible cancellation.`);
    lines.push(`• Food context: ${profile.food.join("; ")}`);
    lines.push(`• Local etiquette: ${profile.culture.join("; ")}`);
  } else if (activityLines.length || restaurantLines.length || stayLines.length) {
    if (activityLines.length) lines.push(`Live place leads:\n${activityLines.join("\n")}`);
    if (restaurantLines.length) lines.push(`Food and dining leads:\n${restaurantLines.join("\n")}`);
    if (stayLines.length) lines.push(`Accommodation leads:\n${stayLines.join("\n")}`);
    lines.push("Treat these as discovery leads from the configured live sources. Before committing, check opening hours, current reviews, final prices, cancellation rules and transport time.");
    if (!restaurantLines.length || !stayLines.length) {
      lines.push(`Useful local fallback: ${practicalDestinationFallback(primaryDestination, resolved).join(" ")}`);
    }
  } else {
    lines.push(practicalDestinationFallback(primaryDestination, resolved).map((line) => `• ${line}`).join("\n"));
  }

  const tips = Array.isArray(culture?.practical_tips) ? culture.practical_tips.slice(0, 3) : [];
  const guidance = Array.isArray(safety?.practical_guidance) ? safety.practical_guidance.slice(0, isSensitive ? 3 : 2) : [];
  const practical = [...guidance, ...tips].filter(Boolean).slice(0, 5);
  lines.push(`\n**Practical travel notes**`);
  lines.push((practical.length ? practical : profile.culture).map((t) => `• ${t}`).join("\n"));

  lines.push(`\n**Best next step**`);
  if (destinations.length > 1) {
    lines.push(`I can turn this into a short route for ${naturalJoin(destinations)} using your dates, budget and pace.`);
  } else if (isCountryScope) {
    lines.push("Tell me the exact city or region and your budget, then I can check local weather, hotels, restaurants and places more accurately.");
  } else {
    lines.push("Share your budget and preferred travel style, and I can narrow this into a practical hotel area, food and daily activity plan.");
  }
  return lines.join("\n\n");
}

function composeAccommodationAnswer(resolved, toolResults = []) {
  const stays = firstResult(toolResults, "smart_accommodation_finder");
  if (!stays) return "";
  const destination = stays.location || locationDisplay(resolved);
  const props = Array.isArray(stays.properties) ? stays.properties.slice(0, 7) : [];
  const budget = resolved.memory?.budget || stays.budget_range || "mid-range";
  const area = resolved.memory?.area ? ` around ${resolved.memory.area}` : "";

  const lines = [`**Hotels and stays in ${destination}**`];
  if (props.length) {
    lines.push(`Here are live discovery leads${area}. Google Places can verify property names and ratings, but not guaranteed room prices or availability.`);
    lines.push(props.map(fmtPlaceLine).join("\n"));
  } else {
    lines.push(`I could not verify a strong live hotel shortlist for this exact request, so I would choose by area first and then confirm final prices on booking platforms.`);
    lines.push(practicalDestinationFallback(destination, resolved).filter((line) => /stay|hotel|accommodation|Thamel|Lazimpat|Boudha|Patan|Lakeside/i.test(line)).map((line) => `• ${line}`).join("\n") || "• Compare central hotels, guesthouses and apartments with recent reviews near your main activities.");
  }

  lines.push(`\n**How to compare**`);
  lines.push("• Check final nightly price after taxes and fees\n• Read recent reviews for noise, Wi‑Fi, hot water and cleanliness\n• Confirm cancellation rules and check-in time\n• Prefer a slightly better location over the absolute lowest price");

  if (/budget|cheap|hostel|guesthouse|homestay/i.test(String(budget)) || /kathmandu|nepal|pokhara/i.test(destination)) {
    lines.push(`\n**Typical planning range**`);
    lines.push("• Hostel dorms: often about $5–15/night in Nepal-style budget markets\n• Simple private rooms: often about $15–35/night\n• Better budget or mid-range hotels: often about $30–70/night");
  }

  lines.push(`\n**Price note**`);
  lines.push(stays.booking_insights || "Live booking prices are not guaranteed by the configured place search. Confirm exact rates and availability for your dates on Booking.com, Agoda, Google Hotels or the property website.");
  return lines.join("\n\n");
}

function composeDiningAnswer(resolved, toolResults = []) {
  const dining = firstResult(toolResults, "intelligent_restaurant_discovery");
  if (!dining) return "";
  const destination = dining.location || locationDisplay(resolved);
  const restaurants = Array.isArray(dining.restaurants) ? dining.restaurants.slice(0, 7) : [];
  const lines = [`**Food and dining in ${destination}**`];

  if (restaurants.length) {
    lines.push("Here are live discovery leads returned by the configured restaurant sources. Use them as a shortlist, then confirm opening hours, menu and recent reviews before going.");
    lines.push(restaurants.map(fmtPlaceLine).join("\n"));
  } else {
    lines.push("I could not verify a reliable live restaurant shortlist for this exact request. Start with local restaurants close to your stay, then compare recent reviews and opening hours.");
  }

  lines.push(`\n**What I would prioritize**`);
  lines.push("• Recent reviews over old high ratings\n• Hygiene and service comments\n• Walking distance or easy transport from your stay\n• One traditional local meal plus one convenient fallback option");

  if (dining.dining_tips) {
    lines.push(`\n**Data note**`);
    lines.push(dining.dining_tips);
  }
  return lines.join("\n\n");
}

function composeGroundedAnswer(message, resolved, toolResults = []) {
  if (resolved.intent.type === "weather_inquiry") return composeWeatherAnswer(resolved, toolResults);
  if (resolved.intent.type === "activity_recommendations") return composeActivityAnswer(resolved, toolResults);
  if (resolved.intent.type === "accommodation_search") return composeAccommodationAnswer(resolved, toolResults);
  if (resolved.intent.type === "dining_recommendations") return composeDiningAnswer(resolved, toolResults);
  if (resolved.intent.type === "destination_planning" || resolved.intent.type === "safety_inquiry") return composeDestinationPipelineAnswer(resolved, toolResults);
  return "";
}

async function callGroq(messages, tools = null, toolChoice = "auto", maxTokens = 900) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const payload = {
    model: MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: 0.25,
    top_p: 0.9,
  };

  if (tools?.length) {
    payload.tools = tools;
    payload.tool_choice = toolChoice;
  }

  const res = await axios.post(GROQ_URL, payload, {
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 45000,
  });

  return res.data.choices?.[0]?.message;
}

function documentFallbackAnswer(message, docs = []) {
  if (!docs.length) {
    return `**I could not find readable document context**\n\nThe file may not have been attached to this chat, or the extracted text did not match the question. Please attach the document again and ask your question in the same chat.`;
  }

  const sourceNames = [...new Set(docs.map((doc) => doc.name))].join(", ");
  const excerpts = docs
    .slice(0, 5)
    .map((doc) => `• ${String(doc.text || "").replace(/\s+/g, " ").trim().slice(0, 380)}`)
    .join("\n");

  return `**Document summary**\n\nI found relevant text in ${sourceNames}. The document appears to discuss the following main points:\n\n${excerpts}\n\n**How to use this**\nUse this as a quick document-based overview. For a cleaner section-by-section summary, ask something like “summarize this PDF in 5 bullet points” or “explain section 2 in simple language.”`;
}

function fallbackAnswer(message, resolved, docs = [], documentFocused = false) {
  if (documentFocused || docs.length) return documentFallbackAnswer(message, docs);

  const destination = contextService.titleCase(resolved.destination || resolved.memory.destination || resolved.locations?.[0] || "your destination");
  const interests = resolved.memory.interests || [];
  const intent = resolved.intent.type;

  if (intent === "accommodation_search") {
    const area = resolved.memory.area || (String(message).toLowerCase().includes("thamel") ? "Thamel" : "the most convenient area");
    return `**Budget stay guidance for ${destination}**\n\nFor a cheaper stay, start with hostels, guesthouses, homestays and simple private-room hotels in ${area}. Choose the area first, then compare recent reviews, total price after fees, Wi-Fi, hot water, noise and cancellation policy.\n\n**Approximate planning ranges**\n• Hostel dorms: usually about $5–15 per night\n• Simple private rooms: usually about $15–35 per night\n• Better budget hotels: usually about $30–60 per night\n\n**How I would compare them**\nIf you want the lowest cost, start with hostels and guesthouses. If you want a quieter private room, compare simple hotels with recent reviews instead of choosing only the lowest price.\n\n**Data note**\nLive booking prices may be unavailable at the moment, so treat these as planning ranges and confirm final rates, taxes and availability on booking platforms for your exact dates.`;
  }

  if (intent === "activity_recommendations" || interests.includes("hiking") || interests.includes("wildlife") || interests.includes("baby") || interests.includes("family")) {
    const focus = interests.includes("baby") || interests.includes("family")
      ? "family-friendly and weather-flexible options"
      : interests.includes("hiking") || interests.includes("wildlife")
      ? "hiking, nature and wildlife options"
      : "activities that match your interests";
    return `**Activity ideas for ${destination}**

Focus on ${focus}. Choose options that fit the weather, transport time and your group rather than trying to cover too many places.

**Practical categories to check**
• Museums, libraries or indoor venues when weather is poor
• Parks, lakeside areas or short nature walks when conditions are good
• Cafes, shopping centres or visitor centres when travelling with a baby or family
• Guided activities only when recent reviews and logistics look reliable

**Data note**
I could not verify live venue data for this exact request, so treat these as planning categories and confirm opening hours, accessibility and recent reviews before going.`;
  }

  if (intent === "dining_recommendations") {
    return `**Food and dining in ${destination}**\n\nFor a good dining experience, combine one traditional local meal with one convenient place near your stay. Prioritize recent reviews, opening hours and location rather than only rating scores.\n\n**Data note**\nLive reservation or availability data may be limited right now, so this guidance relies on established local dining patterns rather than guaranteed table availability.`;
  }

  if (intent === "weather_inquiry") {
    return `**Weather planning for ${destination}**\n\nCheck a local forecast close to departure and plan clothing around flexibility. For outdoor plans, carry light rain protection and leave buffer time for transport delays if rain is likely.\n\n**Data note**\nLive forecast data may be limited right now, so treat this as general planning guidance rather than minute-by-minute weather information.`;
  }

  return `**Travel guidance for ${destination}**\n\nStart with your main purpose, then choose the area, daily pace and transport around that. Keep the plan flexible if the trip is soon.\n\n**Practical checks**\n• Confirm accommodation reviews and final prices before booking\n• Check weather close to departure\n• Save offline maps and your hotel address\n• Carry some local cash for smaller shops and transport\n\n**Data note**\nSome live sources may be limited right now, so this is practical planning guidance rather than guaranteed real-time availability.`;
}

async function getOrCreateConversation(req, message) {
  const { conversationId } = req.body || {};

  if (conversationId) {
    const existing = await Conversation.findOne({ _id: conversationId, userId: req.user._id });
    if (existing) return existing;
  }

  const title = String(message).slice(0, 55) || "New chat";
  return Conversation.create({
    userId: req.user._id,
    title,
    messages: [],
    memory: { locations: [], interests: [], travelDates: [] },
    documentIds: [],
  });
}

async function buildFinalAnswer(message, conversation, resolved, toolResults, retrievedDocs, documentFocused, userPreferences = {}) {
  const docContext = documentService.buildDocumentContext(retrievedDocs, documentFocused ? 6500 : 3500);

  if (documentFocused) {
    const recent = conversation.messages
      .slice(-4)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 700) }));

    const finalMessage = await callGroq([
      { role: "system", content: buildDocumentSystemPrompt(docContext) },
      ...recent,
      { role: "user", content: message },
    ], null, "none", 1000);

    return sanitize(finalMessage?.content || "");
  }

  const system = buildTravelSystemPrompt(resolved, docContext, toolResults, userPreferences);
  const recent = conversation.messages
    .slice(-6)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 900) }));
  const toolContext = toolResults.length ? `\n\nAvailable live/context data:\n${JSON.stringify(toolResults).slice(0, 5000)}` : "";

  const finalMessage = await callGroq([
    { role: "system", content: system },
    ...recent,
    { role: "user", content: `${resolved.enrichedUserMessage}${toolContext}` },
  ], null, "none", 900);

  return sanitize(finalMessage?.content || "");
}

export const chatController = {
  async handleChat(req, res) {
    const started = Date.now();

    try {
      const parsed = validate(chatRequestSchema, req.body || {});
      if (parsed.error) return res.status(400).json({ message: parsed.error });

      const { message, conversationId, documentIds: incomingDocumentIds } = parsed.data;
      req.body.conversationId = conversationId;

      if (isIdentityQuestion(message)) {
        return res.json({
          result: identityResponse(),
          conversationId: req.body?.conversationId || null,
          timestamp: new Date().toISOString(),
        });
      }

      const conversation = await getOrCreateConversation(req, message);
      
      const documentFocused = isDocumentFocusedRequest(message, incomingDocumentIds);
      const resolved = contextService.resolveContext(message, conversation.memory || {}, conversation.messages || []);

      const retrievedDocs = incomingDocumentIds.length
        ? await documentService.searchUserDocuments(req.user._id, message, incomingDocumentIds)
        : [];

      const toolsToUse = relevantToolNames(resolved.intent.type, resolved.locations, documentFocused, resolved).slice(0, 6);
      const toolResults = [];

      for (const toolName of toolsToUse) {
        const args = await buildToolArgs(toolName, resolved);
        if (!args) continue;
        const result = await toolService.executeTool(toolName, args);
        if (result && !result.error) toolResults.push({ tool: toolName, result });
      }

      let answer;
      const liveDataRequired = resolved.intent.type === "weather_inquiry";
      const hasVerifiedToolData = toolResults.some((item) => item?.result?.data_quality?.verified || item?.result?.hourly_forecast?.length);

      const groundedAnswer = !documentFocused ? composeGroundedAnswer(message, resolved, toolResults) : "";

      if (groundedAnswer) {
        answer = groundedAnswer;
      } else if (liveDataRequired && !hasVerifiedToolData && !documentFocused) {
        answer = fallbackAnswer(message, resolved, retrievedDocs, documentFocused);
      } else {
        try {
          answer = await buildFinalAnswer(message, conversation, resolved, toolResults, retrievedDocs, documentFocused, req.user.preferences || {});
        } catch (error) {
          console.warn("⚠️ Final response generation fallback:", error.message);
          answer = fallbackAnswer(message, resolved, retrievedDocs, documentFocused);
        }
      }

      answer = sanitize(answer || fallbackAnswer(message, resolved, retrievedDocs, documentFocused));

      conversation.memory = resolved.memory;
      conversation.messages.push({ role: "user", content: message, intent: documentFocused ? "document_chat" : resolved.intent.type });
      const liveActions = extractLiveActions(toolResults);

      conversation.messages.push({
        role: "assistant",
        content: answer,
        intent: documentFocused ? "document_chat" : resolved.intent.type,
        metadata: {
          toolCount: toolResults.length,
          documentMatches: retrievedDocs.length,
          documentFocused,
          liveActions,
        },
      });

      // Document attachments belong to the conversation where they were used, but new chats start empty.
      conversation.documentIds = incomingDocumentIds;

      if (!conversation.title || conversation.title === "New chat") conversation.title = message.slice(0, 60);
      await conversation.save();

      res.json({
        result: answer,
        conversationId: conversation._id.toString(),
        title: conversation.title,
        memory: conversation.memory,
        timestamp: new Date().toISOString(),
        response_metadata: {
          intent: documentFocused ? "document_chat" : resolved.intent.type,
          processing_time_ms: Date.now() - started,
          tool_count: toolResults.length,
          document_matches: retrievedDocs.length,
          document_focused: documentFocused,
          liveActions,
        },
      });
    } catch (error) {
      console.error("❌ Chat error:", error);
      res.status(500).json({
        message: "I could not complete that request right now. Please try again in a moment.",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  async resetContext(req, res) {
    const conversation = await Conversation.findOne({ _id: req.body?.conversationId, userId: req.user._id });
    if (conversation) {
      conversation.messages = [];
      conversation.memory = { locations: [], interests: [], travelDates: [] };
      conversation.documentIds = [];
      await conversation.save();
    }
    res.json({ ok: true });
  },

  async getContext(req, res) {
    const conversation = await Conversation.findOne({ _id: req.params.userId, userId: req.user._id }).lean();
    res.json({ context: conversation?.memory || {} });
  },

  async getQualityAnalytics(req, res) {
    res.json({ message: "Quality analytics are handled through persisted conversations in this version." });
  },
};

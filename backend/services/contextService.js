const COUNTRY_WORDS = [
  "afghanistan", "albania", "algeria", "andorra", "argentina", "armenia", "australia", "austria", "azerbaijan",
  "bahrain", "bangladesh", "belgium", "bhutan", "brazil", "bulgaria", "cambodia", "canada", "chile", "china",
  "croatia", "cyprus", "czechia", "czech republic", "denmark", "egypt", "estonia", "finland", "france", "georgia",
  "germany", "greece", "hungary", "iceland", "india", "indonesia", "iran", "iraq", "ireland", "israel", "palestine", "palestinian territories", "west bank", "gaza", "italy",
  "japan", "jordan", "kazakhstan", "kenya", "kuwait", "laos", "latvia", "lebanon", "lithuania", "malaysia",
  "maldives", "mexico", "morocco", "nepal", "netherlands", "new zealand", "norway", "oman", "pakistan", "philippines",
  "poland", "portugal", "qatar", "romania", "saudi arabia", "serbia", "singapore", "slovakia", "slovenia",
  "south korea", "spain", "sri lanka", "sweden", "switzerland", "taiwan", "thailand", "turkey", "united arab emirates",
  "uae", "united kingdom", "uk", "united states", "usa", "vietnam"
];

const LOCATION_WORDS = [
  ...COUNTRY_WORDS,
  "tehran", "isfahan", "shiraz", "tabriz", "mashhad", "qom", "yazd", "kish", "ramallah", "bethlehem", "nablus", "hebron",
  "nepal", "kathmandu", "thamel", "pokhara", "chitwan", "nagarkot", "bhaktapur",
  "istanbul", "ankara", "antalya", "tokyo", "osaka", "kyoto", "dubai", "abu dhabi", "doha",
  "helsinki", "riihimäki", "riihimaki", "hyvinkää", "hyvinkaa", "paris", "london", "bangkok", "singapore",
  "southeast asia", "thailand", "vietnam", "indonesia", "malaysia", "japan", "turkey", "finland", "india",
  "delhi", "mumbai", "rome", "barcelona", "amsterdam", "new york", "seoul", "zurich", "zürich", "munich",
  "münchen", "malmo", "malmö", "goteborg", "göteborg", "lodz", "łódź", "copenhagen", "stockholm", "oslo",
  "tallinn", "riga", "vilnius", "warsaw", "krakow", "prague", "vienna", "lisbon", "madrid", "berlin",
  "hamburg", "brussels", "antwerp", "dublin", "edinburgh", "manchester", "budapest", "ljubljana", "zagreb",
  "split", "athens", "porto", "nice", "lyon", "marseille", "geneva", "basel", "turku", "tampere", "espoo",
  "vantaa", "oulu", "jyväskylä", "jyvaskyla", "lahti"
];

const INTENT_RULES = [
  { type: "accommodation_search", words: ["hotel", "hotels", "hostel", "stay", "accommodation", "room", "guesthouse", "guest house", "homestay", "booking", "price", "prices", "night", "lodging"] },
  { type: "weather_inquiry", words: ["weather", "rain", "forecast", "hourly", "hourely", "hourley", "temperature", "climate", "monsoon", "humid", "cold", "hot", "wind", "cloud", "sunny", "raining"] },
  { type: "dining_recommendations", words: ["food", "restaurant", "restaurants", "eat", "dining", "cuisine", "breakfast", "lunch", "dinner", "dish", "traditional dining", "cafe", "cafes", "street food"] },
  { type: "safety_inquiry", words: ["safe", "safety", "concern", "concerns", "risk", "danger", "security", "advisory", "war", "conflict", "protest", "unrest"] },
  { type: "activity_recommendations", words: ["things to do", "activity", "activities", "attraction", "attractions", "experience", "see", "hiking", "trek", "trekking", "wildlife", "safari", "baby-friendly", "family-friendly", "indoor", "outdoor", "tennis", "sports", "play", "court", "courts", "venue", "venues", "parks", "museum", "museums", "free court", "free courts", "public court", "public courts", "municipal court", "municipal courts"] },
  { type: "cultural_inquiry", words: ["culture", "custom", "etiquette", "business", "meeting", "dress", "tradition", "people", "local rules"] },
  { type: "travel_logistics", words: ["visa", "airport", "transport", "sim", "currency", "cash", "card", "entry", "passport", "taxi", "train", "metro"] },
  { type: "destination_planning", words: ["travel", "travelling", "traveling", "trip", "tourist", "tourism", "visit", "visiting", "go to", "going to", "itinerary", "plan", "planning", "weekend", "one week", "week"] },
];

const INTEREST_WORDS = [
  "hiking", "trekking", "wildlife", "food", "culture", "business", "family", "baby", "baby-friendly", "budget",
  "cheap", "luxury", "nature", "shopping", "nightlife", "indoor", "outdoor", "museum", "park", "tennis", "sports",
  "court", "courts", "free", "public", "municipal", "stroller", "kid", "child", "children", "restaurant", "cafe", "library", "tourist", "safety"
];

const BAD_LOCATION_PHRASES = new Set([
  "some", "there", "here", "nearby", "same place", "same area", "same city", "be sure", "just to", "to be", "to be sure", "today", "tomorrow", "this weekend", "next week", "this week",
  "hourly", "hourely", "hourley", "hourly forecast", "weather", "forecast", "rain", "temperature", "then check", "check hourly",
  "city", "destination", "there", "please", "yes", "yes please", "yes sure", "yes i want to know", "i want to know", "want to know", "know",
  "ok", "okay", "sure", "go ahead", "tell me", "tell me more", "show me", "more", "it", "that", "can you", "can you give", "give", "need", "want",
  "play tennis", "tennis", "tennis courts", "sports center", "sports centre", "go play", "playing tennis", "outdoors", "outside", "the city", "live data", "live suggestions"
]);

const NON_LOCATION_WORDS = new Set([
  "a", "an", "the", "i", "we", "you", "can", "could", "would", "should", "please", "give", "tell", "show",
  "check", "then", "find", "search", "suggest", "recommend", "need", "want", "wants", "know", "like", "thinking", "go", "going", "visit", "visiting", "travel", "traveling",
  "travelling", "tourist", "trip", "play", "playing", "tennis", "court", "courts", "football", "soccer", "sport", "sports", "forecast", "hourly", "hourely",
  "hourley", "some", "there", "here", "nearby", "weather", "rain", "temperature", "today", "tomorrow", "weekend", "sure", "just", "best", "experience",
  "baby", "child", "kid", "family", "hotel", "hotels", "restaurant", "restaurants", "price", "prices", "yes", "ok", "okay", "more", "live"
]);

const TRAILING_CONTEXT_WORDS = [
  "today", "tomorrow", "tonight", "this", "next", "with", "for", "from", "to", "and", "or", "but", "as",
  "weather", "forecast", "hourly", "hourely", "hotels", "hotel", "restaurants", "restaurant", "prices", "price",
  "tennis", "court", "courts", "baby", "child", "children", "kid", "family", "tourist", "trip"
];

const TYPO_NORMALIZATION = [
  [/\bhourely\b/g, "hourly"],
  [/\bhourley\b/g, "hourly"],
  [/\bhoury\b/g, "hourly"],
  [/\bhyvinkaa\b/g, "hyvinkaa"],
  [/\briihimaki\b/g, "riihimaki"],
];

function normalize(value = "") {
  let text = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of TYPO_NORMALIZATION) text = text.replace(pattern, replacement);
  return text;
}

function displayNormalize(value = "") {
  return String(value || "").normalize("NFKC").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value = "") {
  return displayNormalize(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(" ");
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(text = "", term = "") {
  const value = normalize(text);
  const key = normalize(term);
  if (!key) return false;
  if (key.includes(" ")) return value.includes(key);
  return new RegExp(`(^|\\b)${escapeRegex(key)}(\\b|$)`, "i").test(value);
}

function isCountryLike(value = "") {
  const key = normalize(value);
  return COUNTRY_WORDS.some((country) => normalize(country) === key);
}

function canonicalDestination(value = "") {
  const key = normalize(value);
  const aliases = {
    palestine: "Palestinian Territories",
    "west bank": "Palestinian Territories",
    gaza: "Gaza",
    uae: "United Arab Emirates",
    uk: "United Kingdom",
    usa: "United States",
    riihimaki: "Riihimäki",
    hyvinkaa: "Hyvinkää",
    zurich: "Zürich",
    munchen: "München",
    malmo: "Malmö",
    goteborg: "Göteborg",
    lodz: "Łódź",
  };
  return aliases[key] || titleCase(value);
}

function isBadLocationCandidate(value = "") {
  const normalized = normalize(value);
  if (!normalized || normalized.length < 2) return true;
  if (BAD_LOCATION_PHRASES.has(normalized)) return true;
  if (/\b(be sure|just to|to be sure|hourly forecast|weather forecast|want to know|i want to know|yes i want|tell me more|live suggestions)\b/i.test(normalized)) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (/\b(suggest|recommend|give|show|tell|find|search|look|need|want|know|please|some|there|here|nearby)\b/i.test(normalized)) return true;
  if (words.every((word) => NON_LOCATION_WORDS.has(word))) return true;
  if (words.length === 1 && NON_LOCATION_WORDS.has(words[0])) return true;
  if (/^(can|give|need|want|know|play|weather|forecast|hourly|tennis|court|courts|baby|family|yes|please|sure|tourist|trip)$/i.test(normalized)) return true;
  return false;
}

function stripLocationCandidate(candidate = "") {
  let value = displayNormalize(candidate)
    .replace(/^[\s,.;:!?()[\]{}]+|[\s,.;:!?()[\]{}]+$/g, "")
    .replace(/^\b(?:ok\s+then|okay\s+then|then|can\s+you|could\s+you|would\s+you|please|give|show|tell|check|find|search|look|looking|get|suggest|recommend)\b\s*/i, "")
    .replace(/^\b(?:visit|visiting|travel(?:ing|ling)?|go(?:ing)?|play(?:ing)?|stay(?:ing)?|in|to|for|near|around|at|from)\b\s*/i, "")
    .replace(/[?.!,;:]+$/g, "")
    .trim();

  const parts = value.split(/\s+/).filter(Boolean);
  const kept = [];
  for (const part of parts) {
    const clean = normalize(part.replace(/[?.!,;:]+/g, ""));
    if (TRAILING_CONTEXT_WORDS.includes(clean)) break;
    kept.push(part);
    if (kept.length >= 4) break;
  }

  value = kept.join(" ").trim();
  if (isBadLocationCandidate(value)) return "";
  return value;
}

function extractLocations(message = "") {
  const raw = String(message || "");
  const text = normalize(raw);
  const found = [];

  for (const loc of LOCATION_WORDS) {
    const normalizedLoc = normalize(loc);
    const escaped = normalizedLoc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i").test(text)) found.push(loc);
  }

  const patterns = [
    /\b(?:weather\s+in|forecast\s+for|hourly\s+forecast\s+for|hotels?\s+in|restaurants?\s+in|things\s+to\s+do\s+in|activities\s+in|near|around|from|at|visit|visiting|travel(?:ing|ling)?\s+to|going\s+to|go\s+to|stay(?:ing)?\s+in)\s+([\p{L}\p{M}][\p{L}\p{M}'.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'.-]*){0,3})/giu,
    /\bin\s+([\p{L}\p{M}][\p{L}\p{M}'.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'.-]*){0,3})\b/giu,
  ];

  for (const pattern of patterns) {
    for (const match of raw.matchAll(pattern)) {
      const cleaned = stripLocationCandidate(match[1]);
      if (cleaned) found.push(cleaned);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const loc of found.map(stripLocationCandidate).filter(Boolean)) {
    const key = normalize(loc);
    if (!seen.has(key)) {
      unique.push(loc);
      seen.add(key);
    }
  }
  return unique;
}

function extractDates(message = "") {
  const patterns = [
    /\b(this weekend|next weekend|next week|this week|tomorrow|today|tonight|right now|this afternoon|this evening)\b/gi,
    /\b\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{0,4}\b/gi,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{0,4}\b/gi,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  ];
  return [...new Set(patterns.flatMap((p) => String(message).match(p) || []))];
}

function isAffirmation(message = "") {
  const text = normalize(message).replace(/[.!?]+$/g, "");
  if (!text) return false;
  const direct = /^(yes|yes please|yes sure|yeah|yeah please|yep|sure|sure please|ok|okay|please|go ahead|do it|sounds good|that would be great|perfect|tell me more|show me|show me please|i want to know|yes i want to know|yes i want|i would like to know)$/i;
  if (direct.test(text)) return true;
  const agreement = /^(yes|yeah|yep|sure|ok|okay|please)\b/i.test(text);
  const wantsMore = /\b(i\s+)?(want|would like|need)\s+(to\s+)?(know|see|hear)|\b(tell|show|give)\s+me\b|\bmore\b/i.test(text);
  const hasNewSpecificIntent = /\b(weather|forecast|hourly|hotel|restaurant|pdf|document|price|visa|airport|safety|itinerary)\b/i.test(text);
  return text.length <= 90 && (agreement || wantsMore) && !hasNewSpecificIntent;
}

function getLastAssistantMessage(previousMessages = []) {
  return [...(previousMessages || [])].reverse().find((m) => m.role === "assistant")?.content || "";
}

function getLastAssistantOfferText(previousMessages = []) {
  const lastAssistant = getLastAssistantMessage(previousMessages);
  if (!lastAssistant) return "";
  const questions = String(lastAssistant)
    .split(/(?<=[?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.includes("?"));
  return questions.at(-1) || lastAssistant;
}

function inferOfferFromAssistantText(assistantText = "", memory = {}) {
  const text = normalize(assistantText);
  const destination = memory.destination || memory.locations?.at?.(-1) || "the same destination";

  if (/\b(tennis|court|courts|sports centre|sports center|sports facilities|where to play)\b/i.test(text)) {
    return { intentType: "activity_recommendations", topic: `verified tennis courts and sports centers in ${titleCase(destination)}`, interests: ["tennis", "sports", "court"] };
  }
  if (text.includes("baby-friendly") || (text.includes("baby") && (text.includes("attraction") || text.includes("restaurant") || text.includes("indoor") || text.includes("venue")))) {
    return { intentType: text.includes("restaurant") && !text.includes("attraction") ? "dining_recommendations" : "activity_recommendations", topic: `baby-friendly attractions, indoor options and restaurants in ${titleCase(destination)}`, interests: ["baby-friendly", "family", "indoor"] };
  }
  if (text.includes("indoor activities") || text.includes("indoor options") || text.includes("attractions") || text.includes("venues") || text.includes("places")) {
    return { intentType: "activity_recommendations", topic: `indoor and practical activities in ${titleCase(destination)}`, interests: ["indoor"] };
  }
  if (text.includes("restaurant") || text.includes("dining") || text.includes("food") || text.includes("cafe")) {
    return { intentType: "dining_recommendations", topic: `restaurant and dining recommendations in ${titleCase(destination)}`, interests: ["food"] };
  }
  if (text.includes("hourly forecast") || text.includes("weather") || text.includes("rain")) {
    return { intentType: "weather_inquiry", topic: `hourly weather forecast for ${titleCase(destination)}`, interests: [] };
  }
  if (text.includes("hotel") || text.includes("accommodation") || text.includes("stay")) {
    return { intentType: "accommodation_search", topic: `accommodation options in ${titleCase(destination)}`, interests: [] };
  }
  if (text.includes("itinerary") || text.includes("plan") || text.includes("route")) {
    return { intentType: "destination_planning", topic: `a practical travel plan for ${titleCase(destination)}`, interests: [] };
  }
  return null;
}

function inferAcceptedOffer(message = "", previousMessages = [], memory = {}) {
  if (!isAffirmation(message)) return null;
  const offerText = getLastAssistantOfferText(previousMessages);
  const inferred = inferOfferFromAssistantText(offerText, memory);
  if (inferred) return inferred;
  const destination = memory.destination || memory.locations?.at?.(-1) || "the same destination";
  return { intentType: memory.lastIntent || "destination_planning", topic: `the previous offer about ${titleCase(destination)}`, interests: [] };
}

function detectIntent(message = "", memory = {}, previousMessages = []) {
  const acceptedOffer = inferAcceptedOffer(message, previousMessages, memory);
  if (acceptedOffer) return { type: acceptedOffer.intentType, confidence: 0.94, isFollowUp: true, acceptedOffer };

  const text = normalize(message);
  const locations = extractLocations(message);
  const hasStoredLocation = Boolean(memory?.destination || memory?.locations?.length);
  const hasDate = /\b(today|tomorrow|tonight|weekend|afternoon|evening|now)\b/.test(text);
  const hasWeather = /\b(weather|forecast|hourly|rain|temperature|wind|cloud|sunny|raining)\b/.test(text);
  const outdoorPlan = /\b(tennis|court|courts|football|soccer|golf|run|running|walk|walking|hiking|picnic|outdoor|outside|park|beach|play)\b/.test(text);
  const broadTravel = /\b(travel|travelling|traveling|trip|tourist|tourism|visit|visiting|going to|go to|planning|weekend|one week)\b/.test(text);
  const explicitAccommodation = /\b(hotel|hotels|hostel|hostels|guesthouse|guesthouses|homestay|accommodation|stay|room|rooms|lodging|booking)\b/.test(text);
  const explicitDining = /\b(restaurant|restaurants|food|dining|eat|cafe|cafes|breakfast|lunch|dinner|cuisine)\b/.test(text);
  const explicitActivity = /\b(tennis|court|courts|museum|museums|park|parks|attraction|attractions|activity|activities|things to do|sports|hiking|wildlife|indoor|outdoor)\b/.test(text);

  if (explicitAccommodation && hasStoredLocation && !locations.length) {
    return { type: "accommodation_search", confidence: 0.92, isFollowUp: true };
  }
  if (explicitDining && hasStoredLocation && !locations.length) {
    return { type: "dining_recommendations", confidence: 0.9, isFollowUp: true };
  }
  if (explicitActivity && hasStoredLocation && !locations.length && !hasWeather) {
    return { type: "activity_recommendations", confidence: 0.9, isFollowUp: true };
  }

  if ((hasWeather || (outdoorPlan && hasDate)) && (locations.length || hasStoredLocation)) {
    return { type: "weather_inquiry", confidence: 0.9, isFollowUp: !locations.length && hasStoredLocation };
  }

  // Broad country/city travel questions should become a destination-planning pipeline,
  // not a single attraction search just because the word "visit" appears.
  if (broadTravel && locations.length && !/\b(restaurant|hotel|weather|forecast|hourly|tennis|court|food|dining)\b/.test(text)) {
    return { type: "destination_planning", confidence: 0.86, isFollowUp: false };
  }

  let best = { type: "destination_planning", score: 0 };
  for (const rule of INTENT_RULES) {
    const score = rule.words.reduce((sum, word) => sum + (containsTerm(text, word) ? 1 : 0), 0);
    if (score > best.score) best = { type: rule.type, score };
  }

  const shortFollowUp = text.length < 90 && !locations.length && hasStoredLocation;
  if (shortFollowUp && best.score === 0 && memory.lastIntent) return { type: memory.lastIntent, confidence: 0.72, isFollowUp: true };

  return { type: best.type, confidence: best.score > 0 ? Math.min(0.95, 0.45 + best.score * 0.15) : 0.35, isFollowUp: shortFollowUp };
}

function updateMemory(memory = {}, message = "", intent = {}) {
  const text = normalize(message);
  const locations = extractLocations(message);
  const dates = extractDates(message);
  const acceptedOffer = intent.acceptedOffer || null;
  const interests = [...INTEREST_WORDS.filter((word) => containsTerm(text, word)), ...(acceptedOffer?.interests || [])];

  const updated = {
    ...memory,
    locations: [...new Set([...(memory.locations || []), ...locations])].slice(-8),
    travelDates: [...new Set([...(memory.travelDates || []), ...dates])].slice(-6),
    interests: [...new Set([...(memory.interests || []), ...interests])].slice(-12),
    lastIntent: intent.type,
    lastTopic: acceptedOffer?.topic || message.slice(0, 180),
    lastAcceptedOffer: acceptedOffer?.topic || memory.lastAcceptedOffer,
  };

  if (locations.length) {
    updated.destination = locations[0];
    updated.locationScope = isCountryLike(locations[0]) ? "country" : "city";
    if (locations.some((loc) => normalize(loc) === "thamel")) updated.area = "Thamel";
    if (locations.some((loc) => normalize(loc) === "kathmandu") && normalize(updated.destination) === "thamel") updated.destination = "kathmandu";
  }

  if (text.includes("cheap") || text.includes("budget") || text.includes("affordable")) updated.budget = "budget";
  if (text.includes("family") || text.includes("kids") || text.includes("children") || text.includes("child") || text.includes("baby") || acceptedOffer?.interests?.includes("family") || acceptedOffer?.interests?.includes("baby-friendly")) updated.groupType = "family";
  if (text.includes("business") || text.includes("meeting") || text.includes("work")) updated.groupType = "business";
  return updated;
}

function resolveContext(message = "", memory = {}, previousMessages = []) {
  const intent = detectIntent(message, memory, previousMessages);
  const locations = extractLocations(message);
  const dates = extractDates(message);
  const destination = locations[0] || memory.destination || (memory.locations || []).at?.(-1) || "";
  const resolvedLocations = locations.length ? locations : [destination, ...(memory.locations || []).filter((loc) => normalize(loc) !== normalize(destination))].filter(Boolean).slice(0, 3);
  const updatedMemory = updateMemory(memory, message, intent);
  const locationScope = locations.length ? (isCountryLike(locations[0]) ? "country" : "city") : (memory.locationScope || (isCountryLike(destination) ? "country" : "city"));

  const previousSummary = previousMessages.slice(-6).map((m) => `${m.role}: ${String(m.content).slice(0, 360)}`).join("\n");

  let enrichedUserMessage = message;
  if (intent.acceptedOffer) {
    enrichedUserMessage = `The user accepted the previous assistant offer. Answer that offer directly and do not repeat the previous answer.\nPrevious destination: ${titleCase(destination)}\nAccepted request: ${intent.acceptedOffer.topic}\nKnown area: ${memory.area || "not specified"}\nKnown interests: ${[...(memory.interests || []), ...(intent.acceptedOffer.interests || [])].filter(Boolean).join(", ") || "not specified"}\nKnown dates: ${(memory.travelDates || dates).join(", ") || "not specified"}\nCurrent user message: ${message}`;
  } else if (intent.isFollowUp || (!locations.length && destination)) {
    enrichedUserMessage = `The user is continuing a previous travel conversation. Keep the answer grounded in this context.\nPrevious destination: ${titleCase(destination)}\nKnown area: ${memory.area || "not specified"}\nKnown interests: ${(memory.interests || []).join(", ") || "not specified"}\nKnown dates: ${(memory.travelDates || dates).join(", ") || "not specified"}\nPrevious topic: ${memory.lastTopic || "not specified"}\nCurrent user message: ${message}`;
  }

  return { intent, locations: resolvedLocations, dates: dates.length ? dates : (memory.travelDates || []), destination, locationScope, memory: { ...updatedMemory, locationScope }, previousSummary, enrichedUserMessage };
}

function contextLabel(memory = {}) {
  const parts = [];
  if (memory.destination) parts.push(`destination: ${titleCase(memory.destination)}`);
  if (memory.locationScope) parts.push(`scope: ${memory.locationScope}`);
  if (memory.area) parts.push(`area: ${memory.area}`);
  if (memory.interests?.length) parts.push(`interests: ${memory.interests.join(", ")}`);
  if (memory.travelDates?.length) parts.push(`dates: ${memory.travelDates.join(", ")}`);
  if (memory.budget) parts.push(`budget: ${memory.budget}`);
  if (memory.groupType) parts.push(`traveler type: ${memory.groupType}`);
  if (memory.lastAcceptedOffer) parts.push(`last accepted offer: ${memory.lastAcceptedOffer}`);
  return parts.join("; ");
}

export const contextService = { extractLocations, extractDates, detectIntent, updateMemory, resolveContext, contextLabel, titleCase, canonicalDestination, normalize, stripLocationCandidate, isCountryLike };

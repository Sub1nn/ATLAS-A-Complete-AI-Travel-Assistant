import { countryService } from "./countryService.js";

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
const ISO_COUNTRY_WORDS = countryService.countryWords;

const LOCATION_WORDS = [
  ...ISO_COUNTRY_WORDS,
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

const LOCATION_COUNTRY_HINTS = new Map(Object.entries({
  tehran: "iran",
  isfahan: "iran",
  shiraz: "iran",
  tabriz: "iran",
  mashhad: "iran",
  qom: "iran",
  yazd: "iran",
  kathmandu: "nepal",
  thamel: "nepal",
  pokhara: "nepal",
  chitwan: "nepal",
  nagarkot: "nepal",
  bhaktapur: "nepal",
  "abu dhabi": "united arab emirates",
  dubai: "united arab emirates",
  tokyo: "japan",
  osaka: "japan",
  kyoto: "japan",
  helsinki: "finland",
  tallinn: "estonia",
  riga: "latvia",
  vilnius: "lithuania",
  turku: "finland",
  tampere: "finland",
  rovaniemi: "finland",
  paris: "france",
  lyon: "france",
  nice: "france",
  doha: "qatar",
}));

const INTENT_RULES = [
  { type: "accommodation_search", words: ["hotel", "hotels", "hostel", "hostels", "motel", "motels", "lodge", "lodges", "resort", "resorts", "apartment", "apartments", "stay", "accommodation", "room", "guesthouse", "guest house", "homestay", "booking", "price", "prices", "night", "lodging", "cheap stay", "luxury stay"] },
  { type: "weather_inquiry", words: ["weather", "rain", "forecast", "hourly", "hourely", "hourley", "temperature", "climate", "monsoon", "humid", "cold", "hot", "wind", "cloud", "sunny", "raining"] },
  { type: "dining_recommendations", words: ["food", "restaurant", "restaurants", "eat", "dining", "cuisine", "breakfast", "lunch", "dinner", "dish", "traditional dining", "cafe", "cafes", "coffee", "street food", "bar", "bars", "pub", "pubs", "nightclub", "nightclubs", "night club", "night clubs", "club", "clubs", "nightlife"] },
  { type: "safety_inquiry", words: ["safe", "safety", "concern", "concerns", "risk", "danger", "security", "advisory", "war", "conflict", "protest", "unrest"] },
  { type: "activity_recommendations", words: ["things to do", "activity", "activities", "attraction", "attractions", "experience", "see", "hiking", "trek", "trekking", "wildlife", "safari", "baby-friendly", "family-friendly", "indoor", "outdoor", "tennis", "sports", "play", "court", "courts", "venue", "venues", "parks", "museum", "museums", "free court", "free courts", "public court", "public courts", "municipal court", "municipal courts", "badminton", "football", "soccer", "basketball", "volleyball", "swimming", "gym", "fitness", "sports centre", "sports center", "yoga", "meditation", "mindfulness", "wellness", "spa", "massage", "retreat"] },
  { type: "cultural_inquiry", words: ["culture", "custom", "etiquette", "business", "meeting", "dress", "tradition", "people", "local rules"] },
  { type: "route_planning", words: ["route", "directions", "direction", "navigate", "navigation", "how to get", "how do i get", "go from", "get from", "drive from", "walk from", "bus from", "train from", "metro from", "distance", "duration" ] },
  { type: "travel_logistics", words: ["visa", "airport", "transport", "sim", "currency", "cash", "card", "entry", "passport", "taxi", "train", "metro"] },
  { type: "destination_planning", words: ["travel", "travelling", "traveling", "trip", "tourist", "tourism", "visit", "visiting", "go to", "going to", "itinerary", "plan", "planning", "weekend", "one week", "week"] },
];

const INTEREST_WORDS = [
  "hiking", "trekking", "wildlife", "food", "culture", "business", "family", "baby", "baby-friendly", "budget",
  "cheap", "luxury", "history", "nature", "art", "beach", "beaches", "shopping", "nightlife", "indoor", "outdoor", "museum", "park", "tennis", "sports",
  "museums", "architecture", "architectural", "landmark", "landmarks",
  "court", "courts", "badminton", "football", "soccer", "basketball", "volleyball", "swimming", "pool", "gym", "fitness", "padel", "pickleball", "squash", "golf", "climbing", "bowling", "skating", "ice skating", "yoga", "meditation", "mindfulness", "wellness", "spa", "massage", "retreat", "sauna", "free", "public", "municipal", "stroller", "kid", "child", "children", "restaurant", "cafe", "coffee", "bar", "pub", "nightlife", "club", "hostel", "motel", "lodge", "guesthouse", "library", "tourist", "safety", "route", "directions"
];

const ACTIVITY_DEFINITIONS = [
  { key: "tennis", words: ["tennis", "tennis court", "tennis courts", "court", "courts"] },
  { key: "badminton", words: ["badminton", "badminton court", "badminton courts"] },
  { key: "football", words: ["football", "soccer", "football pitch", "football field", "soccer field", "futsal"] },
  { key: "basketball", words: ["basketball", "basketball court", "basketball courts"] },
  { key: "volleyball", words: ["volleyball", "beach volleyball", "volleyball court"] },
  { key: "swimming", words: ["swimming", "swim", "pool", "swimming pool", "aquatic centre", "aquatic center"] },
  { key: "gym", words: ["gym", "fitness", "fitness center", "fitness centre", "workout"] },
  { key: "padel", words: ["padel", "paddle tennis", "padel court"] },
  { key: "pickleball", words: ["pickleball", "pickleball court"] },
  { key: "squash", words: ["squash", "squash court"] },
  { key: "golf", words: ["golf", "golf course", "driving range"] },
  { key: "climbing", words: ["climbing", "bouldering", "climbing gym"] },
  { key: "bowling", words: ["bowling", "bowling alley"] },
  { key: "skating", words: ["skating", "ice skating", "skate park", "skatepark"] },
  { key: "running", words: ["running", "jogging", "running track", "track"] },
  { key: "hiking", words: ["hiking", "trek", "trekking", "trail", "nature walk"] },
  { key: "yoga", words: ["yoga", "yoga studio", "yoga class", "yoga classes"] },
  { key: "meditation", words: ["meditation", "mindfulness", "mindfulness class", "meditation center", "meditation centre"] },
  { key: "wellness", words: ["wellness", "spa", "massage", "retreat", "wellness retreat", "mindfulness retreat"] },
  { key: "sauna", words: ["sauna", "saunas", "public sauna", "private sauna", "sauna centre", "sauna center"] },
  { key: "sports", words: ["sports", "sport", "sports centre", "sports center", "sport hall", "play"] },
];

const TEMPORAL_LOCATION_WORDS = new Set([
  "january", "jan", "february", "feb", "march", "mar", "april", "apr", "may", "june", "jun", "july", "jul",
  "august", "aug", "september", "sep", "sept", "october", "oct", "november", "nov", "december", "dec",
  "spring", "summer", "autumn", "fall", "winter", "morning", "afternoon", "evening", "night", "weekend",
  "week", "month", "year",
]);

const LOCATION_ONLY_BLOCKING_WORDS = /\b(weather|forecast|hourly|rain|temperature|wind|hotel|hotels|hostel|hostels|motel|motels|lodge|lodges|guesthouse|guesthouses|resort|resorts|apartment|apartments|accommodation|stay|room|booking|restaurant|restaurants|food|dining|eat|cafe|cafes|coffee|bar|bars|pub|pubs|nightclub|nightclubs|nightlife|route|directions?|navigate|distance|duration|safe|safety|risk|danger|advisory|visa|airport|transport|customs?|declare|restricted|prohibited|bring|pack|medicine|medication|cash|battery|batteries|drone|things to do|activity|activities|attraction|attractions|museum|museums|park|parks|hiking|trek|trekking|wildlife|indoor|outdoor|play|playing|tennis|court|courts|sports?|badminton|football|soccer|basketball|volleyball|swimming|pool|gym|fitness|padel|pickleball|squash|golf|climbing|bowling|skating|running|yoga|meditation|mindfulness|wellness|spa|massage|retreat)\b/i;

const TRANSIENT_VENUE_INTERESTS = new Set([
  "tennis", "sports", "sport", "court", "courts", "badminton", "football", "soccer", "basketball", "volleyball",
  "swimming", "pool", "gym", "fitness", "padel", "pickleball", "squash", "golf", "climbing", "bowling", "skating",
  "ice skating", "sauna", "free", "public", "municipal",
]);
const BAD_LOCATION_PHRASES = new Set([
  "some", "there", "here", "nearby", "same place", "same area", "same city", "be sure", "just to", "to be", "to be sure", "today", "tomorrow", "this weekend", "next week", "this week",
  "hourly", "hourely", "hourley", "hourly forecast", "weather", "forecast", "rain", "temperature", "then check", "check hourly",
  "city", "destination", "there", "please", "yes", "yes please", "yes sure", "yes i want to know", "i want to know", "want to know", "know",
  "ok", "okay", "sure", "go ahead", "tell me", "tell me more", "show me", "more", "it", "that", "can you", "can you give", "give", "need", "want",
  "play tennis", "tennis", "tennis courts", "sports center", "sports centre", "go play", "playing tennis", "yoga", "meditation", "mindfulness", "wellness", "spa", "massage", "retreat", "outdoors", "outside", "the city", "live data", "live suggestions"
]);
for (const word of TEMPORAL_LOCATION_WORDS) BAD_LOCATION_PHRASES.add(word);

const NON_LOCATION_WORDS = new Set([
  "a", "an", "the", "i", "we", "you", "can", "could", "would", "should", "please", "give", "tell", "show",
  "check", "then", "find", "search", "suggest", "recommend", "need", "want", "wants", "know", "like", "thinking", "go", "going", "visit", "visiting", "travel", "traveling",
  "travelling", "tourist", "trip", "play", "playing", "tennis", "court", "courts", "badminton", "football", "soccer", "basketball", "volleyball", "swimming", "gym", "fitness", "yoga", "meditation", "mindfulness", "wellness", "spa", "massage", "retreat", "sport", "sports", "forecast", "hourly", "hourely",
  "hourley", "some", "there", "here", "nearby", "weather", "rain", "temperature", "today", "tomorrow", "weekend", "sure", "just", "best", "experience",
  "baby", "child", "kid", "family", "hotel", "hotels", "restaurant", "restaurants", "street", "food", "dining", "cuisine", "breakfast", "lunch", "dinner", "price", "prices", "yes", "ok", "okay", "more", "live"
]);
for (const word of TEMPORAL_LOCATION_WORDS) NON_LOCATION_WORDS.add(word);

const TRAILING_CONTEXT_WORDS = [
  "today", "tomorrow", "tonight", "this", "next", "with", "without", "for", "from", "to", "near", "around", "and", "or", "but", "as", "after", "before", "under", "over", "per",
  "instead", "keep", "walking",
  "focus", "focused", "focussed", "featuring", "including", "centered", "centred",
  "weather", "forecast", "hourly", "hourely", "hotels", "hotel", "restaurants", "restaurant", "prices", "price",
  "tennis", "court", "courts", "badminton", "football", "soccer", "basketball", "volleyball", "swimming", "gym", "fitness", "yoga", "meditation", "mindfulness", "wellness", "spa", "massage", "retreat", "baby", "child", "children", "kid", "family", "tourist", "trip"
];
TRAILING_CONTEXT_WORDS.push(...TEMPORAL_LOCATION_WORDS);

const TYPO_NORMALIZATION = [
  [/\bhourely\b/g, "hourly"],
  [/\bhourley\b/g, "hourly"],
  [/\bhoury\b/g, "hourly"],
  [/\babu\s+dabi\b/g, "abu dhabi"],
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

function isTermNegated(text = "", term = "") {
  const value = normalize(text).replace(/\bgo\/no\s+go\b/g, "decision");
  const key = normalize(term);
  if (!value || !key) return false;
  return new RegExp(
    `\\b(?:do\\s+not|don['’]?t|dont|no|without|avoid|skip|exclude|excluding|dislike|not\\s+interested\\s+in|not(?:\\s+(?:an?|the))?)\\b[^.!?;]{0,48}\\b${escapeRegex(key)}\\b`,
    "i",
  ).test(value);
}

function containsPositiveTerm(text = "", term = "") {
  return containsTerm(text, term) && !isTermNegated(text, term);
}

function extractPrimaryActivity(message = "", memory = {}, options = {}) {
  const currentText = normalize(message);
  const memoryInterests = Array.isArray(memory?.interests) ? memory.interests.join(" ") : "";
  const rememberedSpecific = ACTIVITY_DEFINITIONS.find((item) =>
    item.key !== "sports" && item.words.some((word) => containsTerm(memoryInterests, word))
  );

  if (!currentText && options.includeMemory) return rememberedSpecific?.key || "";
  if (!currentText) return "";

  for (const activity of ACTIVITY_DEFINITIONS) {
    const matchedCurrent = activity.words.some((word) => containsPositiveTerm(currentText, word));
    if (!matchedCurrent) continue;
    const explicitlyExcluded = activity.words.some((word) => {
      // "not an outdoor court" excludes the venue trait, not tennis itself.
      // Generic court tokens must not erase a positively requested sport.
      if (activity.key === "tennis" && /^(?:court|courts)$/.test(word)) return false;
      return isTermNegated(currentText, word);
    });
    if (explicitlyExcluded) continue;
    const accommodationContext = /\b(hotel|hotels|hostel|hostels|resort|resorts|accommodation|stay|stays|room|rooms|property|properties)\b/.test(currentText);
    if (
      accommodationContext
      && activity.key === "swimming"
      && /\bpools?\b/.test(currentText)
      && !/\b(swim|swimming|aquatic)\b/.test(currentText)
    ) {
      continue;
    }

    // Generic words such as “court”, “courts”, “sports” or “play” should only inherit
    // a previous activity in short follow-ups. They must not make a new destination
    // such as “Kathmandu” keep showing tennis map cards from an older conversation turn.
    if ((activity.key === "tennis" || activity.key === "sports") && /\bcourt(s)?\b/.test(currentText) && rememberedSpecific?.key) {
      return rememberedSpecific.key;
    }

    return activity.key;
  }

  return options.includeMemory ? rememberedSpecific?.key || "" : "";
}

function isLocationOnlyFollowUp(message = "", memory = {}, locations = extractLocations(message)) {
  const text = normalize(message);
  const hasStoredLocation = Boolean(memory?.destination || memory?.locations?.length);
  if (!hasStoredLocation || !locations.length || !text || text.length > 140) return false;
  if (LOCATION_ONLY_BLOCKING_WORDS.test(text)) return false;

  let residue = text;
  for (const loc of [...locations].sort((a, b) => normalize(b).length - normalize(a).length)) {
    const key = normalize(loc);
    if (!key) continue;
    residue = residue.replace(new RegExp(`(^|\\b)${escapeRegex(key)}(\\b|$)`, "gi"), " ");
  }

  residue = residue
    .replace(/\b(and|or|then|also|plus|with|near|around|in|to|at|from|the|city|cities|area|areas|region|regions|same|base|bases)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, "")
    .trim();

  return residue.length <= 8;
}


function activityDisplayName(activity = "") {
  const labels = {
    football: "football/soccer",
    swimming: "swimming",
    gym: "gym or fitness",
    padel: "padel",
    pickleball: "pickleball",
    squash: "squash",
    climbing: "climbing",
    skating: "skating",
    running: "running",
    yoga: "yoga",
    meditation: "meditation",
    wellness: "wellness",
    sports: "sports",
  };
  return labels[normalize(activity)] || normalize(activity) || "sports";
}

function isCountryLike(value = "") {
  return countryService.isCountryName(value);
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
    "abu dhabi": "Abu Dhabi",
    riihimaki: "Riihimäki",
    hyvinkaa: "Hyvinkää",
    zurich: "Zürich",
    munchen: "München",
    malmo: "Malmö",
    goteborg: "Göteborg",
    lodz: "Łódź",
  };
  const countryName = countryService.canonicalCountryName(value);
  if (countryName) return countryName;
  return aliases[key] || titleCase(value);
}

function inferredCountry(value = "") {
  const key = normalize(value);
  if (!key) return "";
  if (isCountryLike(key)) return key;
  return LOCATION_COUNTRY_HINTS.get(key) || "";
}

function pruneLocationsForCurrentDestination(locations = [], destination = "") {
  const destinationCountry = inferredCountry(destination);
  if (!destinationCountry) return locations;
  const destinationKey = normalize(destination);
  return locations.filter((loc) => {
    const key = normalize(loc);
    if (!key) return false;
    if (key === destinationKey) return true;
    if (isCountryLike(key)) return key === destinationCountry;
    const locCountry = inferredCountry(key);
    return !locCountry || locCountry === destinationCountry;
  });
}

function isBadLocationCandidate(value = "") {
  const normalized = normalize(value);
  if (!normalized || normalized.length < 2) return true;
  if (BAD_LOCATION_PHRASES.has(normalized)) return true;
  if (/\b(be sure|just to|to be sure|hourly forecast|weather forecast|want to know|i want to know|yes i want|tell me more|live suggestions)\b/i.test(normalized)) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (words.every((word) => INTEREST_WORDS.includes(word))) return true;
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
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const clean = normalize(part.replace(/[?.!,;:]+/g, ""));
    const nextClean = normalize((parts[index + 1] || "").replace(/[?.!,;:]+/g, ""));
    // A second “in” normally starts timing or request context (for example,
    // “Japan in late October”), not part of the destination name.
    if (clean === "in") break;
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
    if (
      normalizedLoc === "split"
      && /\bsplit\s+(?:(?:the\s+)?(?:time|days?|trip|budget|cost|stay|visit|itinerary)\b|between\b)/i.test(raw)
    ) {
      continue;
    }
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
  const knownKeys = new Set(
    unique
      .filter((location) => LOCATION_WORDS.some((known) => normalize(known) === normalize(location)))
      .map((location) => normalize(location)),
  );
  const filtered = unique.filter((location) => {
    const key = normalize(location);
    if (knownKeys.has(key)) return true;
    return ![...knownKeys].some((known) => key.startsWith(`${known} `) || key.endsWith(` ${known}`));
  });
  return filtered.sort((a, b) => {
    const aIndex = text.indexOf(normalize(a));
    const bIndex = text.indexOf(normalize(b));
    if (aIndex < 0 && bIndex < 0) return 0;
    if (aIndex < 0) return 1;
    if (bIndex < 0) return -1;
    return aIndex - bIndex;
  });
}

function extractOriginHint(message = "") {
  const match = String(message || "").match(
    /\bfrom\s+([\p{L}\p{M}][\p{L}\p{M}'.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'.-]*){0,3})/iu,
  );
  const origin = stripLocationCandidate(match?.[1] || "");
  return /^\d/.test(origin) ? "" : origin;
}

function collapseCountryQualifiers(locations = [], message = "") {
  const raw = displayNormalize(message);
  if (locations.length < 2 || !raw) return locations;

  return locations.filter((location) => {
    if (!isCountryLike(location)) return true;
    const country = String(location).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !locations.some((candidate) => {
      if (isCountryLike(candidate) || normalize(candidate) === normalize(location)) return false;
      const city = String(candidate).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${city}\\s*,\\s*${country}\\b`, "iu").test(raw);
    });
  });
}

function destinationLocations(message = "", memory = {}, intent = {}) {
  const locations = collapseCountryQualifiers(locationsForMessage(message, memory), message);
  if (locations.length < 2 || intent.type === "route_planning" || intent.customsQuestion) return locations;
  const origin = normalize(extractOriginHint(message));
  if (!origin) return locations;
  const withoutOrigin = locations.filter((location) => normalize(location) !== origin);
  return withoutOrigin.length ? withoutOrigin : locations;
}

function cleanTravelRole(value = "") {
  return stripLocationCandidate(
    String(value || "")
      .replace(/\b(?:tomorrow|today|tonight|on\s+\w+|at\s+\d{1,2}(?::\d{2})?|with|carrying|for|via)\b[\s\S]*$/i, "")
      .replace(/[?.!,;:]+$/g, "")
      .trim(),
  );
}

function extractTravelRoles(message = "") {
  const raw = String(message || "").trim();
  if (!raw) return { origin: "", destination: "", transit: [] };

  const flightLike = raw.match(
    /\b(?:fly(?:ing)?|travel(?:ing|ling)?|go(?:ing)?)?\s*from\s+([^?.,;]+?)\s+to\s+([^?.,;]+?)(?=\s+via\b|\s+with\b|\s+carrying\b|\s+and\s+(?:bring|carry|pack|take)\b|[?.,;]|$)(?:\s+via\s+([^?.,;]+?)(?=\s+with\b|\s+carrying\b|\s+and\s+(?:bring|carry|pack|take)\b|[?.,;]|$))?/i,
  );
  if (!flightLike) return { origin: "", destination: "", transit: [] };

  const origin = cleanTravelRole(flightLike[1]);
  const destination = cleanTravelRole(flightLike[2]);
  const transit = String(flightLike[3] || "")
    .split(/\s*(?:,|and)\s*/i)
    .map(cleanTravelRole)
    .filter(Boolean)
    .slice(0, 4);
  return { origin, destination, transit };
}

function extractVisaDestination(message = "", locations = []) {
  const raw = String(message || "");
  const match = raw.match(/\b(?:visa\s+for|enter|visit|travel(?:ing|ling)?\s+to|(?:tourist|business)?\s*trip\s+to|going\s+to)\s+([\p{L}\p{M}][\p{L}\p{M}'.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'.-]*){0,3})/iu);
  const candidate = stripLocationCandidate(match?.[1] || "");
  if (candidate) {
    const known = locations.find((location) => normalize(location) === normalize(candidate));
    return known || candidate;
  }
  return locations.at(-1) || "";
}

function extractVisaTravellerContext(message = "") {
  const raw = String(message || "");
  const nationality = raw.match(/\b(?:i\s+am|i'm|as)\s+(?:an?\s+)?([\p{L}\p{M}'-]+)\s+(?:citizen|national|passport\s+holder)\b/iu)?.[1]
    || raw.match(/\b([\p{L}\p{M}'-]+)\s+passport\b/iu)?.[1]
    || "";
  const residence = raw.match(
    /\b(?:living|resident|residing|live)\s+in\s+([\p{L}\p{M}][\p{L}\p{M}'-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'-]*){0,3}?)(?=\s*(?:[.,;?!]|$|\b(?:and|but|while|with)\b))/iu,
  )?.[1] || "";
  return {
    nationality: nationality ? titleCase(nationality) : "",
    residence: residence ? canonicalDestination(stripLocationCandidate(residence)) : "",
  };
}

function extractRequestConstraints(message = "", previous = {}) {
  const raw = String(message || "");
  const text = normalize(raw);
  const constraints = { ...(previous || {}) };
  const setTrue = (key, pattern) => {
    if (pattern.test(text)) constraints[key] = true;
  };

  setTrue("accessible", /\b(accessible|accessibility|wheelchair|step[-\s]?free|mobility)\b/);
  setTrue("senior", /\b(senior|elderly|older (?:adult|parent|mother|father)|\d{2,3}[-\s]?year[-\s]?old)\b/);
  setTrue("minimalWalking", /\b(minimal|minimum|least|little|less|lowest|low|limited|avoid|short)\s+(?:amount\s+of\s+)?walking\b|\bwalking\s+(?:as little as possible|limit|minimum|minimal|least|lowest|low|limited)\b|\bshortest\s+walk(?:ing)?\b/);
  setTrue("minimalWalking", /\b(?:avoid|avoiding|limit|limited)\s+(?:steep\s+)?(?:walking|walks?|hills?|slopes?|inclines?|stairs?|steps?)\b|\b(?:steep\s+walking|steep\s+walks?|many\s+stairs?|long\s+walks?)\b/);
  setTrue("minimalWalking", /\b(knee|ankle|hip|leg)\s+(?:injury|pain|problem)|\b(?:moderate|gentle)\s+walking\b|\bfrequent\s+(?:rest|seating)|\brest\s+stops?\b/);
  setTrue("minimalTransfers", /\b(minimal|minimum|few|fewer|fewest|least|avoid|no)\s+transfers?\b|\btransfers?\s+(?:as little as possible|minimal|minimum|limited|fewest|least)\b|\b(?:direct|no[-\s]?change)\s+(?:route|service|train|bus|option)\b/);
  setTrue("noCar", /\b(?:without|no)\s+(?:a\s+)?car\b|\b(?:do\s+not|don['’]?t|cannot|can['’]?t)\s+drive\b|\bpublic\s+transport\s+only\b/);
  setTrue("indoorAlternative", /\b(indoor|covered)\s+(?:alternative|option|backup)s?\b/);
  setTrue("indoorPreferred", /\b(?:indoor[-\s]?focused|focus(?:ed)?\s+on\s+indoor|mostly\s+indoor|keep\s+(?:it|the\s+plan)\s+indoors?)\b/);
  setTrue("rainAlternative", /\b(if it rains|rainy\s+day|rain(?:y)?\s+(?:alternative|option|backup)|wet[-\s]?weather)\b/);
  setTrue("breakfastPreferred", /\b(breakfast (?:preferred|included)|include breakfast|with breakfast|breakfast)\b/);
  const amenities = [
    ["pool", /\b(pool|swimming pool)\b/],
    ["gym", /\b(gym|fitness centre|fitness center)\b/],
    ["spa", /\bspa\b/],
    ["parking", /\bparking\b/],
  ].filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  if (amenities.length) constraints.amenities = [...new Set([...(constraints.amenities || []), ...amenities])];

  const dietary = [
    ["vegetarian", /\bvegetarian\b/],
    ["vegan", /\bvegan|plant[-\s]?based\b/],
    ["halal", /\bhalal\b/],
    ["kosher", /\bkosher\b/],
    ["gluten-free", /\bgluten[-\s]?free\b/],
  ].filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  if (dietary.length) constraints.dietary = [...new Set([...(constraints.dietary || []), ...dietary])];

  const budgetMatch = raw.match(/\b(?:under|below|maximum|max(?:imum)?|up to|budget(?:\s+of)?)\s*([€$£¥]|EUR|USD|GBP|JPY)?\s*([\d,.]+)/i)
    || raw.match(/([€$£¥])\s*([\d,.]+)\s*(?:total|altogether|for both|for all)?/i);
  if (budgetMatch) {
    const currencyToken = String(budgetMatch[1] || "").toUpperCase();
    const currency = { "€": "EUR", "$": "USD", "£": "GBP", "¥": "JPY" }[currencyToken] || currencyToken;
    const amount = Number(String(budgetMatch[2] || "").replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) constraints.maxBudget = amount;
    if (currency) constraints.currency = currency;
  }

  const monthPattern = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const stayRange = raw.match(new RegExp(`\\b(?:from\\s+)?(\\d{1,2})\\s*(?:[–—-]|to|until|through)\\s*(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})\\b`, "i"));
  if (!stayRange) {
    const timeRangeMatch = raw.match(/\bbetween\s+(\d{1,2}(?::\d{2})?)\s+and\s+(\d{1,2}(?::\d{2})?)\b/i);
    if (timeRangeMatch) {
      constraints.startTime = timeRangeMatch[1].includes(":") ? timeRangeMatch[1] : `${timeRangeMatch[1]}:00`;
      constraints.endTime = timeRangeMatch[2].includes(":") ? timeRangeMatch[2] : `${timeRangeMatch[2]}:00`;
    } else {
      const startMatch = raw.match(/\b(?:(?:start|starting)\s+)?(?:after|from)\s+(\d{1,2}(?::\d{2})?)\b/i)
        || raw.match(/\b(?:start|starting)\s+at\s+(\d{1,2}(?::\d{2})?)\b/i);
      if (startMatch) constraints.startTime = startMatch[1].includes(":") ? startMatch[1] : `${startMatch[1]}:00`;
      const endMatch = raw.match(/\b(?:until|to|before)\s+(\d{1,2}(?::\d{2})?)\b/i);
      if (endMatch) constraints.endTime = endMatch[1].includes(":") ? endMatch[1] : `${endMatch[1]}:00`;
    }
  }

  const dayCountMatch = raw.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)(?:(?:\s+[\p{L}\p{M}-]+){0,3}\s+days?|[-\s]?days?)\b/iu);
  if (dayCountMatch) {
    const dayWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14 };
    const days = dayWords[normalize(dayCountMatch[1])] || Number(dayCountMatch[1]);
    if (Number.isFinite(days) && days > 0 && days <= 31) constraints.dayCount = days;
  }
  if (!dayCountMatch && /\b(?:plan|itinerary)\b[\s\S]{0,48}\b(?:a|one|single|relaxed|full)\s+day\b|\bday[-\s]+(?:trip|plan|itinerary)\b/i.test(raw)) {
    constraints.dayCount = 1;
  }
  if (
    /\b(?:half[-\s]?day|morning|afternoon|evening)\s+(?:plan|itinerary)\b|\b(?:plan|itinerary|build|create)\b[\s\S]{0,48}\b(?:morning|afternoon|evening)\b|\b(?:just|only|one)\b[\s\S]{0,32}\b(?:morning|afternoon|evening)\b/i.test(raw)
  ) {
    constraints.dayCount = 1;
  }
  const stopLimitMatch = raw.match(/\b(?:no more than|up to|maximum|max)\s+(\d+|one|two|three|four|five)\s+stops?\b/i);
  if (stopLimitMatch) {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    constraints.maxStops = words[normalize(stopLimitMatch[1])] || Number(stopLimitMatch[1]);
  }
  const resultCountMatch = raw.match(
    /\b(?:suggest|show|give|find|recommend|compare|list)?\s*(?:me\s+)?(?:exactly|only|top|best)?\s*(\d+|one|two|three|four|five)\s+(?:(?:genuinely|vegetarian|vegan|halal|kosher|accessible|budget|luxury|local|nearby|indoor|outdoor|breakfast|lunch|dinner|dining|meal)\s+){0,3}(?:places?|options?|viewpoints?|attractions?|restaurants?|hotels?|stays?|venues?|stops?)\b/i,
  );
  if (!constraints.maxStops && resultCountMatch) {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    constraints.maxStops = words[normalize(resultCountMatch[1])] || Number(resultCountMatch[1]);
  }

  if (stayRange) {
    const months = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
      sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
    };
    const month = months[normalize(stayRange[3])];
    const year = Number(stayRange[4]);
    const checkIn = new Date(Date.UTC(year, month, Number(stayRange[1])));
    const checkOut = new Date(Date.UTC(year, month, Number(stayRange[2])));
    if (Number.isFinite(checkIn.getTime()) && Number.isFinite(checkOut.getTime()) && checkOut > checkIn) {
      constraints.checkIn = checkIn.toISOString().slice(0, 10);
      constraints.checkOut = checkOut.toISOString().slice(0, 10);
    }
  }

  const adultsMatch = raw.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+adults?\b/i);
  if (adultsMatch) {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    constraints.adults = words[normalize(adultsMatch[1])] || Number(adultsMatch[1]);
  }
  const childAges = [...raw.matchAll(/\b(?:child|children|kid|kids)(?:\s+aged?|\s+ages?)?\s+(\d{1,2})(?:\s*(?:,|and)\s*(\d{1,2}))?/gi)]
    .flatMap((match) => [match[1], match[2]])
    .filter(Boolean)
    .map(Number)
    .filter((age) => age >= 0 && age <= 17);
  if (childAges.length) constraints.childAges = [...new Set(childAges)];
  const roomMatch = raw.match(/\b(\d+|one|two|three|four)\s+rooms?\b/i);
  if (roomMatch) {
    const words = { one: 1, two: 2, three: 3, four: 4 };
    constraints.roomQuantity = words[normalize(roomMatch[1])] || Number(roomMatch[1]);
  }
  const hotelChangeMatch = raw.match(/\b(?:no more than|at most|maximum|max)[\s\S]{0,20}?(\d+|one|two|three|once|twice|thrice)\s+(?:hotel|accommodation|base)\s+changes?\b/i)
    || raw.match(/\b(?:change|changing)\s+(?:hotels?|accommodation|bases?)\s+(?:no more than|at most|more than)\s+(\d+|one|two|three|once|twice|thrice)(?:\s+times?)?\b/i);
  if (hotelChangeMatch) {
    const words = { one: 1, once: 1, two: 2, twice: 2, three: 3, thrice: 3 };
    constraints.maxHotelChanges = words[normalize(hotelChangeMatch[1])] ?? Number(hotelChangeMatch[1]);
  }
  if (/\b(old town|historic centre|historic center|city centre|city center|central)\b/i.test(raw)) {
    constraints.focus = raw.match(/\b(old town|historic centre|historic center|city centre|city center|central)\b/i)?.[1] || "";
  }

  const origin = extractOriginHint(raw);
  if (origin && /\b(?:plan|trip|travel|travelling|traveling|visit|visiting|route|directions?|get|go|journey)\b/i.test(raw)) {
    constraints.origin = origin;
  }

  const exclusions = [...raw.matchAll(/\b(?:do\s+not|don['’]?t|dont|dislike|not\s+interested\s+in|skip|exclude|excluding|avoid|without|no(?!\s+more\s+than))\s+(?:the\s+)?([a-z][a-z -]{1,36}?)(?=\s+(?:and|but|while|with|for|to|focus|just)\b|[,.!?;]|$)/gi)]
    .map((match) => normalize(match[1]))
    .filter(Boolean);
  if (exclusions.length) constraints.exclusions = [...new Set([...(constraints.exclusions || []), ...exclusions])].slice(-8);

  return constraints;
}

function inferStandaloneLocation(message = "", memory = {}) {
  const raw = displayNormalize(message)
    .replace(/^[\s,.;:!?()[\]{}]+|[\s,.;:!?()[\]{}]+$/g, "")
    .trim();
  const text = normalize(raw);
  const hasStoredLocation = Boolean(memory?.destination || memory?.locations?.length);
  if (!raw || !text || raw.length > 80) return "";
  if (LOCATION_ONLY_BLOCKING_WORDS.test(text)) return "";
  if (isBadLocationCandidate(raw)) return "";

  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 4) return "";
  if (words.every((word) => NON_LOCATION_WORDS.has(word))) return "";

  const titleLike = /^[\p{Lu}][\p{L}\p{M}'-]*(?:\s+[\p{Lu}][\p{L}\p{M}'-]*){0,3}$/u.test(raw);
  const countryLike = isCountryLike(raw);
  const shortLocationFollowUp = hasStoredLocation && words.length <= 3 && !/\b(and|or|with|near|around|from|to)\b/i.test(text);

  if (!titleLike && !countryLike && !shortLocationFollowUp) return "";
  return raw;
}

function locationsForMessage(message = "", memory = {}) {
  const locations = extractLocations(message);
  if (locations.length) return locations;
  const standalone = inferStandaloneLocation(message, memory);
  return standalone ? [standalone] : [];
}

const WEEKDAY_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

function extractDates(message = "") {
  const patterns = [
    /\b(this weekend|next weekend|next week|this week|tomorrow|today|tonight|right now|this afternoon|this evening)\b/gi,
    /\b(?:this|next)?\s*(?:mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\b/gi,
    /\b\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{0,4}\b/gi,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{0,4}\b/gi,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  ];
  return [...new Set(patterns.flatMap((p) => String(message).match(p) || []).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(base, days) {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function weekdayFromText(value = "") {
  const text = normalize(value);
  const match = text.match(/\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/);
  if (!match) return null;
  const word = match[1];
  const full = word.startsWith("mon") ? "monday"
    : word.startsWith("tue") ? "tuesday"
    : word.startsWith("wed") ? "wednesday"
    : word.startsWith("thu") ? "thursday"
    : word.startsWith("fri") ? "friday"
    : word.startsWith("sat") ? "saturday"
    : "sunday";
  return WEEKDAY_INDEX[full];
}

function resolveDateContext(message = "", baseDate = new Date()) {
  const dates = extractDates(message);
  const phrase = dates[0] || "";
  if (!phrase) return null;

  const text = normalize(phrase);
  const base = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));

  if (/\bright now\b|\btoday\b|\btonight\b|\bthis afternoon\b|\bthis evening\b/.test(text)) {
    return { raw: phrase, label: phrase, iso: isoDate(base), kind: "single_day" };
  }
  if (/\btomorrow\b/.test(text)) {
    return { raw: phrase, label: phrase, iso: isoDate(addDays(base, 1)), kind: "single_day" };
  }
  if (/\bthis weekend\b/.test(text)) {
    const current = base.getUTCDay();
    const daysUntilSaturday = (6 - current + 7) % 7;
    return { raw: phrase, label: phrase, iso: isoDate(addDays(base, daysUntilSaturday || 0)), kind: "weekend_start" };
  }
  if (/\bnext weekend\b/.test(text)) {
    const current = base.getUTCDay();
    const daysUntilSaturday = ((6 - current + 7) % 7) + 7;
    return { raw: phrase, label: phrase, iso: isoDate(addDays(base, daysUntilSaturday)), kind: "weekend_start" };
  }

  const weekday = weekdayFromText(text);
  if (weekday !== null) {
    const current = base.getUTCDay();
    let delta = (weekday - current + 7) % 7;
    if (/\bnext\b/.test(text)) delta = delta === 0 ? 7 : delta + 7;
    // "this Saturday" should mean the coming Saturday, not a stale forecast day.
    return { raw: phrase, label: phrase, iso: isoDate(addDays(base, delta)), kind: "single_day" };
  }

  return { raw: phrase, label: phrase, iso: "", kind: "text" };
}

function isAffirmation(message = "") {
  const text = normalize(message).replace(/[.!?]+$/g, "");
  if (!text) return false;
  const direct = /^(yes|yes please|yes sure|yeah|yeah please|yep|sure|sure please|ok|okay|please|go ahead|do it|sounds good|that would be great|perfect|tell me more|show me|show me please|i want to know|yes i want to know|yes i want|i would like to know)$/i;
  if (direct.test(text)) return true;
  const agreement = /^(yes|yeah|yep|sure|ok|okay|please)\b/i.test(text);
  const wantsMore = /\b(i\s+)?(want|would like|need)\s+(to\s+)?(know|see|hear)|\b(tell|show|give)\s+me\b|\bmore\b/i.test(text);
  const hasNewSpecificIntent = /\b(weather|forecast|hourly|hotel|hostel|motel|lodge|restaurant|cafe|bar|pub|nightclub|nightlife|club|pdf|document|price|visa|airport|safety|itinerary|route|directions|walking|walk|transfers?|direct|fastest|quickest|cheapest|accessible|step[-\s]?free)\b/i.test(text);
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
  if (!offerText) return null;
  const inferred = inferOfferFromAssistantText(offerText, memory);
  if (inferred) return inferred;
  const destination = memory.destination || memory.locations?.at?.(-1) || "the same destination";
  return { intentType: memory.lastIntent || "destination_planning", topic: `the previous offer about ${titleCase(destination)}`, interests: [] };
}


function cleanRouteEndpoint(value = "") {
  return String(value || "")
    .replace(/^(?:a|the)?\s*(?:hotel|accommodation|stay)\s+(?:near|around|in)\s+/i, "")
    .replace(/\s+by\s+(?:walk(?:ing)?|drive|driving|car|bus|train|metro|subway|transit|public transport|cycle|cycling|bike|biking)(?:\s+(?:today|tomorrow|tonight|this\s+(?:morning|afternoon|evening|weekend)|on\s+\w+))?\s*$/i, "")
    .replace(/\s+(?:today|tomorrow|tonight|this\s+(?:morning|afternoon|evening|weekend))\s*$/i, "")
    .replace(/\s+(?:today|tomorrow|tonight|on\s+\w+)(?:\s+at\s+\d{1,2}(?::\d{2})?)?[\s\S]*$/i, "")
    .replace(/\s+at\s+\d{1,2}(?::\d{2})?[\s\S]*$/i, "")
    .replace(/\s+by\s+(?:walk(?:ing)?|drive|driving|car|bus|train|metro|subway|transit|public transport|cycle|cycling|bike|biking)\s*$/i, "")
    .replace(/[?!.]+$/g, "")
    .trim();
}

function extractRouteRequest(message = "") {
  const raw = String(message || "").trim();
  if (!raw) return null;

  const modeMatch = raw.match(/\b(walk(?:ing)?|drive|driving|car|bus|train|metro|subway|transit|public transport|cycle|cycling|bike|biking)\b/i);
  const modeText = normalize(modeMatch?.[1] || "");
  const mode = /walk/.test(modeText)
    ? "walking"
    : /cycle|bike/.test(modeText)
    ? "bicycling"
    : /train/.test(modeText)
    ? "train"
    : /bus|metro|subway|transit|public transport/.test(modeText)
    ? "transit"
    : /drive|driving|car/.test(modeText)
    ? "driving"
    : "transit";

  const patterns = [
    /\bfrom\s+([^?.,;]+?)\s+(?:to|towards?)\s+([^?.,;]+?)(?:[,;?!.]|$)/i,
    /\b(?:route|directions?|navigate|how\s+(?:do\s+)?i\s+get|how\s+to\s+get|go|get|travel|drive|walk|bus|train|metro)\s+(?:from\s+)([^?.,;]+?)\s+(?:to|towards?)\s+([^?.,;]+?)[?!.]*$/i,
    /\bfrom\s+([^?.,;]+?)\s+(?:to|towards?)\s+([^?.,;]+?)[?!.]*$/i,
    /\b(?:to|towards?)\s+([^?.,;]+?)\s+(?:from\s+)([^?.,;]+?)[?!.]*$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    let origin;
    let destination;
    if (pattern.source.startsWith('\\b(?:to')) {
      destination = stripLocationCandidate(cleanRouteEndpoint(match[1]));
      origin = stripLocationCandidate(cleanRouteEndpoint(match[2]));
    } else {
      origin = stripLocationCandidate(cleanRouteEndpoint(match[1]));
      destination = stripLocationCandidate(cleanRouteEndpoint(match[2]));
    }
    const startsLikeClock = (value = "") => /^\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?(?:\s|$)/i.test(String(value).trim());
    if (origin && destination && !startsLikeClock(origin) && !startsLikeClock(destination)) {
      const arrivalClock = raw.match(/\b(?:arrive|arriving|arrival)\s+(?:by|at|before)\s+(\d{1,2})(?::(\d{2}))?\b/i);
      const departureClock = arrivalClock
        ? null
        : raw.match(/\b(?:depart(?:ing|ure)?\s+(?:at|after)|leave|leaving\s+(?:at|after)|at|after|from)\s+(\d{1,2})(?::(\d{2}))?\b/i);
      const dateContext = resolveDateContext(raw);
      return {
        origin,
        destination,
        mode,
        departureTime: departureClock
          ? `${String(Number(departureClock[1])).padStart(2, "0")}:${String(Number(departureClock[2] || 0)).padStart(2, "0")}`
          : "",
        arrivalTime: arrivalClock
          ? `${String(Number(arrivalClock[1])).padStart(2, "0")}:${String(Number(arrivalClock[2] || 0)).padStart(2, "0")}`
          : "",
        dateLabel: dateContext?.label || "",
        targetDate: dateContext?.iso || "",
      };
    }
  }

  return null;
}

function extractLayoverRequest(message = "", previous = {}) {
  const raw = String(message || "").trim();
  const text = normalize(raw);
  const explicitLayover = /\b(layover|stopover|flight connection|connecting flight|connection time|transit time)\b/.test(text);
  const connectionFollowUp = Boolean(previous?.airport)
    && /\b(arrival|departure|terminal|gate|same ticket|same booking|checked through|collect (?:my )?bag|leave the airport|stay airside|go landside)\b/.test(text);
  if (!explicitLayover && !connectionFollowUp) return null;

  const hourMatch = raw.match(/\b(\d+(?:\.\d+)?)\s*[-\s]?\s*(?:hours?|hrs?)\b/i);
  const minuteMatch = raw.match(/\b(\d{1,3})\s*[-\s]?\s*(?:minutes?|mins?)\b/i);
  const airportMatch = raw.match(/\b(?:at|in)\s+([\p{L}\p{M}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'’.-]*){0,5}?)(?=\s+(?:with|for|between|and|before|after|on)\b|[,.?!]|$)/iu);
  const terminalMatches = [...raw.matchAll(/\b(?:terminal|t)\s*([1-9][a-z]?)\b/gi)].map((match) => `T${String(match[1]).toUpperCase()}`);
  const durationMinutes = hourMatch
    ? Math.round(Number(hourMatch[1]) * 60 + Number(minuteMatch?.[1] || 0))
    : minuteMatch
    ? Number(minuteMatch[1])
    : Number(previous.durationMinutes || 0) || null;

  return {
    airport: stripLocationCandidate(airportMatch?.[1] || previous.airport || ""),
    durationMinutes,
    arrivalTerminal: terminalMatches[0] || previous.arrivalTerminal || "",
    departureTerminal: terminalMatches[1] || terminalMatches[0] || previous.departureTerminal || "",
    cabinLuggage: /\b(cabin|carry[-\s]?on|hand)\s+(?:bag|bags|baggage|luggage)\b/.test(text) || Boolean(previous.cabinLuggage),
    checkedThrough: /\b(?:bag|bags|baggage|luggage)\s+(?:is|are|will be|checked)\s+(?:checked\s+)?through\b|\bchecked through\b/.test(text) || Boolean(previous.checkedThrough),
    sameTicket: /\b(?:same|one|single)\s+(?:ticket|booking|reservation|pnr)\b/.test(text) || Boolean(previous.sameTicket),
  };
}

function detectIntent(message = "", memory = {}, previousMessages = []) {
  const acceptedOffer = inferAcceptedOffer(message, previousMessages, memory);
  if (acceptedOffer) return { type: acceptedOffer.intentType, confidence: 0.94, isFollowUp: true, acceptedOffer };

  const text = normalize(message);
  const layoverRequest = extractLayoverRequest(message, memory.layover || {});
  const locations = locationsForMessage(message, memory);
  const hasStoredLocation = Boolean(memory?.destination || memory?.locations?.length);
  const hasDate = /\b(today|tomorrow|tonight|weekend|afternoon|evening|now)\b/.test(text);
  const hasWeather = ["weather", "forecast", "hourly", "rain", "temperature", "wind", "cloud", "sunny", "raining"]
    .some((term) => containsPositiveTerm(text, term));
  const primaryActivity = extractPrimaryActivity(message, memory);
  const outdoorPlan = Boolean(primaryActivity) || ["run", "running", "walk", "walking", "hiking", "picnic", "outdoor", "outside", "park", "beach", "play"]
    .some((term) => containsPositiveTerm(text, term));
  const broadTravel = /\b(travel|travelling|traveling|trip|tourist|tourism|visit|visiting|going to|go to|planning|weekend|one week)\b/.test(text);
  const budgetUseOfStay = /\bstay\s+(?:under|below|within)\s*(?:[€$£¥]|eur\b|usd\b|gbp\b|jpy\b|\d)/.test(text);
  const explicitAccommodation = ["hotel", "hotels", "hostel", "hostels", "motel", "motels", "lodge", "lodges", "guesthouse", "guesthouses", "guest house", "resort", "resorts", "apartment", "apartments", "homestay", "accommodation", "room", "rooms", "lodging", "booking"]
    .some((term) => containsPositiveTerm(text, term))
    || (!budgetUseOfStay && containsPositiveTerm(text, "stay"));
  const explicitDining = ["restaurant", "restaurants", "food", "dining", "eat", "cafe", "cafes", "coffee", "breakfast", "lunch", "dinner", "cuisine", "bar", "bars", "pub", "pubs", "nightclub", "nightclubs", "night club", "night clubs", "nightlife"]
    .some((term) => containsPositiveTerm(text, term));
  const explicitActivity = Boolean(primaryActivity) || ["museum", "museums", "park", "parks", "attraction", "attractions", "activity", "activities", "things to do", "wildlife", "indoor", "outdoor"]
    .some((term) => containsPositiveTerm(text, term));
  const explicitSafety = ["safe", "safety", "risk", "danger", "security", "advisory", "war", "conflict", "unrest"]
    .some((term) => containsPositiveTerm(text, term));
  const mixedPlanningCategoryCount = [explicitAccommodation, explicitDining, explicitActivity].filter(Boolean).length;
  const planningPhrase = /\b(plan|planning|build|create|make it|revise|refine|adjust|update|itinerary|one[-\s]?day|day plan|weekend|visit|visiting|travel|traveling|travelling|trip)\b/.test(text);
  const explicitDayPlan = /\b(?:one|1)(?:\s+\w+){0,3}\s+day\b|\bday[-\s]?plan\b|\bitinerary\b/.test(text);
  const explicitMultiDayPlan = /\b(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)[-\s]+days?\b/.test(text);
  const explicitHalfDayPlan = /\b(?:plan|build|create|make it)\b[\s\S]{0,64}\b(?:morning|afternoon|evening)\b|\b(?:just|only|one)\b[\s\S]{0,32}\b(?:morning|afternoon|evening)\b/.test(text);
  const timedPlan = /\b(?:plan|itinerary)\b[\s\S]{0,180}\b(?:from|between)\s+\d{1,2}(?::\d{2})?\b/.test(text);
  const basePlan = /\b(?:recommend|choose|suggest)\b[\s\S]{0,140}\b(?:base|bases|nights?)\b/.test(text);
  const routeRequest = extractRouteRequest(message);
  const hasRoute = Boolean(routeRequest) || /\b(route|directions?|navigation|navigate|how to get|how do i get|go from|get from|distance|duration)\b/.test(text);
  const routePreferenceFollowUp = Boolean(memory?.route?.origin && memory?.route?.destination)
    && /\b(?:same|that|this|the)\s+(?:route|journey|trip|option)\b|\b(?:least|less|lowest|minimum|minimal|shortest)\s+(?:amount\s+of\s+)?walking\b|\bshortest\s+walk(?:ing)?\b|\b(?:fewest|fewer|least|no|avoid)\s+transfers?\b|\b(?:fastest|quickest|shortest|simplest|direct|cheapest)\s+(?:route|journey|service|train|bus|option)\b/.test(text);
  const locationOnlyFollowUp = isLocationOnlyFollowUp(message, memory, locations);
  const customsQuestion = /\b(customs?|declare|declaration|restricted|prohibited|allowed|bring|carry|take|pack|packing|import|border|airport security)\b/.test(text)
    && /\b(medicine|medication|prescription|insulin|food|meat|dairy|cheese|milk|cash|money|power bank|battery|lithium|drone|alcohol|tobacco|weapon|spray)\b/.test(text);
  const visaQuestion = /\b(visa|visa[-\s]?free|entry requirements?|need a visa|immigration permission)\b/.test(text);
  const itineraryContinuation = hasStoredLocation
    && (memory.lastIntent === "destination_planning" || /\b(?:day|itinerary|plan|trip)\b/.test(normalize(memory.lastTopic || "")))
    && /\b(make it|revise|refine|adjust|update|make\b[\s\S]{0,80}\b(?:breakfast|lunch|dinner|meal|backup|stop|plan|quieter|calmer|slower|faster|easier|accessible|cheaper|shorter|longer)|add\b[\s\S]{0,80}\b(?:backup|alternative|stop|meal|activity|experience|attraction|visit|lake|museum|park|beach)|replace|change|keep (?:the )?(?:same|whole)|whole day|same (?:requirements|plan|trip)|focus (?:on|around)|start (?:after|at|from)|under\s*[€$£¥]?\s*\d+)\b/.test(text);
  const selectionFollowUp = hasStoredLocation
    && /\b(which (?:one|two|three|four|five|six|seven|eight|nine|ten|[1-9]|10)|which of those|which of these|those options|these options|(?:pick|choose|select|show|give|compare|rank) (?:the )?(?:one|two|three|four|five|six|seven|eight|nine|ten|[1-9]|10)|(?:best|top|only|exactly) (?:one|two|three|four|five|six|seven|eight|nine|ten|[1-9]|10))\b/.test(text);

  if (layoverRequest) {
    return { type: "travel_logistics", confidence: 0.98, isFollowUp: !/\b(layover|stopover|flight connection|connecting flight)\b/.test(text), layoverRequest };
  }

  if (customsQuestion) {
    return { type: "travel_logistics", confidence: 0.98, isFollowUp: false, customsQuestion: true };
  }

  if (visaQuestion) {
    return { type: "travel_logistics", confidence: 0.98, isFollowUp: !locations.length && hasStoredLocation, visaQuestion: true };
  }

  if (hasRoute) {
    return { type: "route_planning", confidence: routeRequest ? 0.96 : 0.78, isFollowUp: !routeRequest && hasStoredLocation, routeRequest };
  }

  if (routePreferenceFollowUp) {
    return { type: "route_planning", confidence: 0.96, isFollowUp: true, routeRequest: memory.route };
  }

  if (selectionFollowUp && memory.lastIntent) {
    return { type: memory.lastIntent, confidence: 0.94, isFollowUp: true, selectionFollowUp: true };
  }

  if (explicitSafety && (locations.length || hasStoredLocation)) {
    return { type: "safety_inquiry", confidence: 0.95, isFollowUp: !locations.length && hasStoredLocation };
  }

  if (itineraryContinuation) {
    return { type: "destination_planning", confidence: 0.96, isFollowUp: true, itineraryContinuation: true };
  }

  if (locationOnlyFollowUp) {
    return { type: "destination_planning", confidence: 0.88, isFollowUp: true, locationOnlyFollowUp: true };
  }

  if (
    planningPhrase
    && (locations.length || hasStoredLocation)
    && (mixedPlanningCategoryCount >= 2 || explicitDayPlan || explicitMultiDayPlan || explicitHalfDayPlan || timedPlan || basePlan)
  ) {
    return { type: "destination_planning", confidence: 0.91, isFollowUp: !locations.length && hasStoredLocation };
  }

  if (explicitAccommodation && locations.length) {
    return { type: "accommodation_search", confidence: 0.94, isFollowUp: false };
  }
  if (explicitDining && locations.length) {
    return { type: "dining_recommendations", confidence: 0.93, isFollowUp: false };
  }
  if (explicitAccommodation && hasStoredLocation && !locations.length) {
    return { type: "accommodation_search", confidence: 0.92, isFollowUp: true };
  }
  // Sport and activity requests should trigger venue discovery immediately. Weather is
  // added later as supporting context instead of replacing the venue search.
  if (explicitActivity && (locations.length || hasStoredLocation || /\b(nearby|near me|around here|here|there)\b/.test(text))) {
    return { type: "activity_recommendations", confidence: primaryActivity ? 0.94 : 0.86, isFollowUp: !locations.length && hasStoredLocation, primaryActivity };
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
  if (broadTravel && locations.length && !/\b(restaurant|hotel|weather|forecast|hourly|tennis|court|badminton|football|soccer|basketball|volleyball|swimming|gym|fitness|padel|pickleball|squash|golf|climbing|bowling|skating|food|dining)\b/.test(text)) {
    return { type: "destination_planning", confidence: 0.86, isFollowUp: false };
  }

  let best = { type: "destination_planning", score: 0 };
  for (const rule of INTENT_RULES) {
    const score = rule.words.reduce((sum, word) => sum + (containsPositiveTerm(text, word) ? 1 : 0), 0);
    if (score > best.score) best = { type: rule.type, score };
  }

  const shortFollowUp = text.length < 90 && !locations.length && hasStoredLocation;
  if (shortFollowUp && best.score === 0 && memory.lastIntent) return { type: memory.lastIntent, confidence: 0.72, isFollowUp: true };

  return { type: best.type, confidence: best.score > 0 ? Math.min(0.95, 0.45 + best.score * 0.15) : 0.35, isFollowUp: shortFollowUp };
}

function updateMemory(memory = {}, message = "", intent = {}, baseDate = new Date()) {
  const text = normalize(message);
  const locations = destinationLocations(message, memory, intent);
  const dates = extractDates(message);
  const dateContext = resolveDateContext(message, baseDate);
  const acceptedOffer = intent.acceptedOffer || null;
  const routeRequest = intent.type === "route_planning" ? (intent.routeRequest || extractRouteRequest(message)) : null;
  const layoverRequest = intent.layoverRequest || null;
  const primaryActivity = intent.primaryActivity || extractPrimaryActivity(message, memory) || extractPrimaryActivity(acceptedOffer?.topic || "");
  const interests = [
    ...INTEREST_WORDS.filter((word) => {
      if (!containsPositiveTerm(text, word)) return false;
      if (word === "free") return /\b(?:for free|free (?:court|courts|entry|activity|activities|attraction|attractions|museum|museums|tour|tours|option|options))\b/.test(text);
      if (word === "public") return /\bpublic (?:court|courts|pool|pools|sauna|saunas|park|parks|facility|facilities|venue|venues)\b/.test(text);
      if (word === "municipal") return /\bmunicipal (?:court|courts|pool|pools|sauna|saunas|park|parks|facility|facilities|venue|venues)\b/.test(text);
      return true;
    }),
    ...(primaryActivity ? [primaryActivity] : []),
    ...(acceptedOffer?.interests || []),
  ];
  const locationOnlyDestinationFollowUp = intent.locationOnlyFollowUp && intent.type === "destination_planning";
  const itineraryDestinationFollowUp = intent.type === "destination_planning"
    && /\b(plan|itinerary|one[-\s]?day|1[-\s]?day|day plan|morning|lunch|afternoon|stay base)\b/.test(text);
  const previousInterests = locationOnlyDestinationFollowUp
    ? (memory.interests || []).filter((item) => !TRANSIENT_VENUE_INTERESTS.has(normalize(item)))
    : (memory.interests || []);
  const previousCountry = inferredCountry(memory.destination || "");
  const nextCountry = inferredCountry(locations[0] || "");
  const switchedCountry = Boolean(previousCountry && nextCountry && previousCountry !== nextCountry);
  const explicitDestinationReplacement = Boolean(
    locations[0]
    && memory.destination
    && normalize(locations[0]) !== normalize(memory.destination)
    && /\b(?:instead|switch|change|move)\b/.test(text),
  );
  const contextChanged = switchedCountry || explicitDestinationReplacement;
  const keepsSameDates = /\b(?:same dates?|keep (?:the )?same dates?)\b/.test(text);
  const keepsSameBudget = /\b(?:same (?:dates? and )?budget|keep (?:the )?same budget)\b/.test(text);
  const explicitlyKeepsRequirements = /\b(same (?:plan|requirements|constraints|preferences|dates?(?: and budget)?|budget(?: and dates?)?)|keep (?:the )?(?:same|plan|requirements|constraints|preferences|dates?|budget))\b/.test(text);
  const continuesPreviousPlan = /\b(?:make|switch|change|move)\b[\s\S]{0,48}\b(?:instead|same plan)\b/.test(text);
  const portableConstraintKeys = [
    "accessible",
    "senior",
    "minimalWalking",
    "minimalTransfers",
    "dietary",
    "indoorAlternative",
    "indoorPreferred",
    "rainAlternative",
  ];
  const portableConstraints = Object.fromEntries(
    portableConstraintKeys
      .filter((key) => memory.constraints?.[key] !== undefined)
      .map((key) => [key, memory.constraints[key]]),
  );
  const constraintBase = contextChanged
    ? explicitlyKeepsRequirements
      ? (memory.constraints || {})
      : continuesPreviousPlan
      ? portableConstraints
      : {}
    : (memory.constraints || {});
  const requestConstraints = intent.customsQuestion ? {} : extractRequestConstraints(message, constraintBase);
  const exclusions = new Set((requestConstraints.exclusions || []).map(normalize));
  const interestBase = contextChanged && !explicitlyKeepsRequirements ? [] : previousInterests;
  const retainedInterests = interestBase.filter((item) => ![...exclusions].some((excluded) => containsTerm(item, excluded) || containsTerm(excluded, item)));
  const incomingInterests = interests.filter((item) => ![...exclusions].some((excluded) => containsTerm(item, excluded) || containsTerm(excluded, item)));

  const updated = {
    ...memory,
    locations: [...new Set([...(memory.locations || []), ...locations])].slice(-8),
    travelDates: [...new Set([...(memory.travelDates || []), ...dates])].slice(-6),
    interests: [...new Set([...retainedInterests, ...incomingInterests])].slice(-12),
    lastIntent: intent.type,
    lastTopic: acceptedOffer?.topic || message.slice(0, 180),
    lastAcceptedOffer: acceptedOffer?.topic || memory.lastAcceptedOffer,
    constraints: requestConstraints,
  };
  if (dateContext?.iso) updated.targetDate = dateContext.iso;

  if (contextChanged && !explicitlyKeepsRequirements) {
    delete updated.area;
    delete updated.stayType;
    delete updated.diningStyle;
    delete updated.route;
    delete updated.pendingActivitySearch;
    delete updated.layover;
    if (!keepsSameDates) delete updated.targetDate;
    if (!/\b(budget|cheap|affordable|luxury|premium)\b/.test(text)) delete updated.budget;
  }

  if (locationOnlyDestinationFollowUp || itineraryDestinationFollowUp) delete updated.pendingActivitySearch;
  if (requestConstraints.exclusions?.length && updated.pendingActivitySearch) {
    const pending = normalize(updated.pendingActivitySearch.activity);
    if (requestConstraints.exclusions.some((item) => containsTerm(item, pending) || containsTerm(pending, item))) {
      delete updated.pendingActivitySearch;
    }
  }

  if (locations.length) {
    updated.destination = locations[0];
    updated.locationScope = isCountryLike(locations[0]) ? "country" : "city";
    if (locations.some((loc) => normalize(loc) === "thamel")) updated.area = "Thamel";
    if (locations.some((loc) => normalize(loc) === "kathmandu") && normalize(updated.destination) === "thamel") updated.destination = "kathmandu";
    if (locationOnlyDestinationFollowUp) {
      const countryContext = (memory.locations || []).filter((loc) => isCountryLike(loc)).slice(-1);
      updated.locations = [...new Set([...countryContext, ...locations])].slice(-8);
    }
    const comparisonCountries = locations.filter((loc) => isCountryLike(loc));
    const keepsCountryComparison = comparisonCountries.length > 1
      && /\b(compare|comparison|versus|vs\.?|which (?:is|one)|safer)\b/.test(text);
    updated.locations = keepsCountryComparison
      ? [...new Set(locations)].slice(0, 8)
      : pruneLocationsForCurrentDestination(updated.locations, updated.destination).slice(-8);
  }

  const areaMatch = String(message || "").match(/\b(?:near|around|close to|by|next to)\s+(?:the\s+)?([A-Z][\p{L}\p{M}'-]*(?:\s+[A-Z][\p{L}\p{M}'-]*){0,4})/u);
  if (areaMatch?.[1] && !/hotel|hotels|hostel|hostels|restaurant|restaurants|weather|airport|station/i.test(areaMatch[1])) {
    updated.area = areaMatch[1].trim();
  }

  if (/\b(moderate|mid[-\s]?range)(?:\s+(?:budget|hotels?|stays?|accommodation))?\b/.test(text)) updated.budget = "mid-range";
  else if (
    text.includes("cheap")
    || text.includes("affordable")
    || text.includes("low cost")
    || text.includes("low-cost")
    || (text.includes("budget") && !keepsSameBudget && !Number(requestConstraints.maxBudget))
  ) updated.budget = "budget";
  if (text.includes("luxury") || text.includes("premium") || text.includes("expensive") || text.includes("five star") || text.includes("5 star")) updated.budget = "luxury";
  if (/\bhostel|hostels\b/.test(text)) updated.stayType = "hostel";
  else if (/\bmotel|motels\b/.test(text)) updated.stayType = "motel";
  else if (/\blodge|lodges\b/.test(text)) updated.stayType = "lodge";
  else if (/\bguesthouse|guest house|guesthouses\b/.test(text)) updated.stayType = "guesthouse";
  else if (/\bresort|resorts\b/.test(text)) updated.stayType = "resort";
  else if (/\bapartment|apartments\b/.test(text)) updated.stayType = "apartment";
  if (["bar", "bars", "pub", "pubs", "nightclub", "nightclubs", "night club", "night clubs", "nightlife", "club", "clubs"].some((term) => containsPositiveTerm(text, term))) updated.diningStyle = "nightlife";
  else if (["cafe", "cafes", "coffee"].some((term) => containsPositiveTerm(text, term))) updated.diningStyle = "cafes";
  if (text.includes("family") || text.includes("kids") || text.includes("children") || text.includes("child") || text.includes("baby") || acceptedOffer?.interests?.includes("family") || acceptedOffer?.interests?.includes("baby-friendly")) updated.groupType = "family";
  if (text.includes("business") || text.includes("meeting") || text.includes("work")) updated.groupType = "business";
  if (intent.type === "activity_recommendations" && primaryActivity) {
    updated.pendingActivitySearch = {
      activity: primaryActivity,
      activityLabel: activityDisplayName(primaryActivity),
      location: locations[0] || memory.destination || memory.locations?.at?.(-1) || "",
      date: dateContext?.raw || dates[0] || memory.travelDates?.at?.(-1) || "",
      targetDate: dateContext?.iso || memory.pendingActivitySearch?.targetDate || "",
    };
  }
  if (routeRequest) updated.route = routeRequest;
  if (layoverRequest) updated.layover = layoverRequest;
  return updated;
}

function requestBaseDate(clientLocalDate = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(clientLocalDate || ""))) return new Date();
  const parsed = new Date(`${clientLocalDate}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function resolveContext(message = "", memory = {}, previousMessages = [], options = {}) {
  const baseDate = requestBaseDate(options.clientLocalDate);
  const intent = detectIntent(message, memory, previousMessages);
  const layoverRequest = intent.layoverRequest || (intent.type === "travel_logistics" ? extractLayoverRequest(message, memory.layover || {}) : null);
  const locations = destinationLocations(message, memory, intent);
  const visaDestination = intent.visaQuestion ? extractVisaDestination(message, locations) : "";
  const visaTraveller = intent.visaQuestion ? extractVisaTravellerContext(message) : null;
  const travelRoles = extractTravelRoles(message);
  const dates = extractDates(message);
  const dateContext = resolveDateContext(message, baseDate);
  const currentActivity = extractPrimaryActivity(message, memory);
  const offeredActivity = extractPrimaryActivity(intent.acceptedOffer?.topic || "");
  const carryPendingActivity = intent.type === "activity_recommendations"
    && intent.isFollowUp
    && (intent.selectionFollowUp || !locations.length);
  const primaryActivity = intent.primaryActivity || currentActivity || offeredActivity || (carryPendingActivity ? memory.pendingActivitySearch?.activity : "") || "";
  const roleDestination = intent.customsQuestion ? travelRoles.destination : "";
  const destination = roleDestination || visaDestination || locations[0] || memory.destination || (memory.locations || []).at?.(-1) || "";
  const currentLocations = roleDestination
    ? [roleDestination, ...travelRoles.transit, travelRoles.origin, ...locations].filter(Boolean)
    : visaDestination
    ? [visaDestination]
    : locations;
  const uniqueLocations = (values = []) => {
    const seen = new Set();
    return values.filter((value) => {
      const key = normalize(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const resolvedLocations = currentLocations.length
    ? uniqueLocations(currentLocations)
    : uniqueLocations([destination, ...(memory.locations || []).filter((loc) => normalize(loc) !== normalize(destination))]).slice(0, 3);
  const updatedMemory = updateMemory(memory, message, intent, baseDate);
  const retainedDateContext = intent.isFollowUp && updatedMemory.targetDate
    ? {
        raw: updatedMemory.travelDates?.at?.(-1) || updatedMemory.targetDate,
        label: updatedMemory.travelDates?.at?.(-1) || updatedMemory.targetDate,
        iso: updatedMemory.targetDate,
        kind: "single_day",
      }
    : null;
  if (roleDestination) {
    updatedMemory.destination = roleDestination;
    updatedMemory.locations = resolvedLocations.slice(0, 8);
    updatedMemory.locationScope = isCountryLike(roleDestination) ? "country" : "city";
  } else if (visaDestination) {
    updatedMemory.destination = visaDestination;
    updatedMemory.locations = [visaDestination];
    updatedMemory.locationScope = isCountryLike(visaDestination) ? "country" : "city";
  }
  const locationScope = roleDestination
    ? (isCountryLike(roleDestination) ? "country" : "city")
    : visaDestination
    ? (isCountryLike(visaDestination) ? "country" : "city")
    : locations.length
    ? (isCountryLike(locations[0]) ? "country" : "city")
    : (memory.locationScope || (isCountryLike(destination) ? "country" : "city"));

  const previousSummary = previousMessages.slice(-6).map((m) => `${m.role}: ${String(m.content).slice(0, 360)}`).join("\n");

  let enrichedUserMessage = message;
  if (intent.acceptedOffer) {
    enrichedUserMessage = `The user accepted the previous assistant offer. Answer that offer directly and do not repeat the previous answer.\nPrevious destination: ${titleCase(destination)}\nAccepted request: ${intent.acceptedOffer.topic}\nKnown area: ${memory.area || "not specified"}\nKnown interests: ${[...(memory.interests || []), ...(intent.acceptedOffer.interests || [])].filter(Boolean).join(", ") || "not specified"}\nKnown dates: ${(memory.travelDates || dates).join(", ") || "not specified"}\nKnown constraints: ${JSON.stringify(updatedMemory.constraints || {})}\nCurrent user message: ${message}`;
  } else if (intent.isFollowUp || (!locations.length && destination)) {
    enrichedUserMessage = `The user is continuing a previous travel conversation. Keep the answer grounded in this context.\nPrevious destination: ${titleCase(destination)}\nKnown area: ${memory.area || "not specified"}\nKnown interests: ${(memory.interests || []).join(", ") || "not specified"}\nKnown dates: ${(memory.travelDates || dates).join(", ") || "not specified"}\nKnown constraints: ${JSON.stringify(updatedMemory.constraints || {})}\nPrevious topic: ${memory.lastTopic || "not specified"}\nCurrent user message: ${message}`;
  }

  const activityRequest = primaryActivity ? {
    activity: primaryActivity,
    activityLabel: activityDisplayName(primaryActivity),
    location: locations[0] || destination,
    date: dateContext?.raw || retainedDateContext?.raw || dates[0] || memory.pendingActivitySearch?.date || memory.travelDates?.at?.(-1) || "",
    targetDate: dateContext?.iso || retainedDateContext?.iso || memory.pendingActivitySearch?.targetDate || "",
  } : null;

  const previousActivityDateContext = intent.type === "activity_recommendations" && memory.pendingActivitySearch?.targetDate
    ? { raw: memory.pendingActivitySearch.date || "previous date", label: memory.pendingActivitySearch.date || "previous date", iso: memory.pendingActivitySearch.targetDate, kind: "single_day" }
    : null;

  const journeyRequest = intent.type === "destination_planning"
    && updatedMemory.constraints?.origin
    && normalize(updatedMemory.constraints.origin) !== normalize(destination)
    ? {
        origin: updatedMemory.constraints.origin,
        destination,
        mode: "transit",
        departureTime: "",
        dateLabel: dateContext?.label || retainedDateContext?.label || "",
        targetDate: dateContext?.iso || retainedDateContext?.iso || "",
      }
    : null;

  return {
    intent,
    currentUserMessage: message,
    locations: resolvedLocations,
    explicitLocations: locations,
    previousDestination: memory.destination || "",
    dates: dates.length ? dates : (memory.travelDates || []),
    dateContext: dateContext || retainedDateContext || previousActivityDateContext,
    destination,
    locationScope,
    routeRequest: intent.type === "route_planning" ? (intent.routeRequest || updatedMemory.route || null) : null,
    journeyRequest,
    activityRequest,
    layoverRequest,
    travelRoles,
    requestProfile: {
      customs: Boolean(intent.customsQuestion),
      visa: intent.visaQuestion ? visaTraveller : null,
      layover: layoverRequest,
      itineraryContinuation: Boolean(intent.itineraryContinuation),
      constraints: updatedMemory.constraints || {},
    },
    memory: { ...updatedMemory, locationScope },
    previousSummary,
    enrichedUserMessage,
  };
}

function contextLabel(memory = {}) {
  const parts = [];
  if (memory.destination) parts.push(`destination: ${titleCase(memory.destination)}`);
  if (memory.locationScope) parts.push(`scope: ${memory.locationScope}`);
  if (memory.area) parts.push(`area: ${memory.area}`);
  if (memory.interests?.length) parts.push(`interests: ${memory.interests.join(", ")}`);
  if (memory.travelDates?.length) parts.push(`dates: ${memory.travelDates.join(", ")}`);
  if (memory.budget) parts.push(`budget: ${memory.budget}`);
  if (memory.stayType) parts.push(`stay type: ${memory.stayType}`);
  if (memory.diningStyle) parts.push(`dining style: ${memory.diningStyle}`);
  if (memory.groupType) parts.push(`traveler type: ${memory.groupType}`);
  if (memory.lastAcceptedOffer) parts.push(`last accepted offer: ${memory.lastAcceptedOffer}`);
  return parts.join("; ");
}

export const contextService = {
  extractLocations,
  extractDates,
  resolveDateContext,
  requestBaseDate,
  extractRouteRequest,
  extractLayoverRequest,
  extractTravelRoles,
  extractRequestConstraints,
  extractPrimaryActivity,
  activityDisplayName,
  detectIntent,
  updateMemory,
  resolveContext,
  contextLabel,
  titleCase,
  canonicalDestination,
  normalize,
  containsPositiveTerm,
  isTermNegated,
  stripLocationCandidate,
  isCountryLike,
  isLocationOnlyFollowUp,
};

import axios from "axios";
import { AsyncLocalStorage } from "async_hooks";
import { cacheKey, getOrSetCache } from "./cacheService.js";
import { logger } from "../utils/logger.js";
import { getLocationData } from "../utils/locationUtils.js";
import { countryService } from "./countryService.js";

const tools = [
  {
    type: "function",
    function: {
      name: "comprehensive_weather_analysis",
      description: "Get current weather and short-term forecast for a resolved location.",
      parameters: {
        type: "object",
        properties: {
          latitude: { type: ["number", "string"], description: "Latitude coordinate" },
          longitude: { type: ["number", "string"], description: "Longitude coordinate" },
          location_name: { type: "string", description: "Human-readable location name" },
        },
        required: ["latitude", "longitude", "location_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "intelligent_restaurant_discovery",
      description: "Find restaurants and dining options using Google Places with query expansion.",
      parameters: {
        type: "object",
        properties: {
          lat: { type: ["number", "string"], description: "Latitude coordinate" },
          lon: { type: ["number", "string"], description: "Longitude coordinate" },
          location_name: { type: "string", description: "Human-readable location name" },
          cuisine_preference: { type: "string", description: "Cuisine preference, e.g. local traditional, vegetarian, street food" },
          budget_level: { type: "string", description: "Budget level, e.g. budget, mid-range, premium" },
        },
        required: ["lat", "lon", "location_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "smart_accommodation_finder",
      description: "Find accommodation options using Google Places with budget-aware query expansion.",
      parameters: {
        type: "object",
        properties: {
          lat: { type: ["number", "string"], description: "Latitude coordinate" },
          lon: { type: ["number", "string"], description: "Longitude coordinate" },
          location_name: { type: "string", description: "Human-readable location name" },
          budget_category: { type: "string", description: "Budget category, e.g. budget, cheap, mid-range, luxury" },
          stay_type: { type: "string", description: "Type of stay, e.g. hotel, hostel, guesthouse" },
          preferred_area: { type: "string", description: "Requested area such as central or old town" },
          check_in: { type: "string", description: "Check-in date in YYYY-MM-DD" },
          check_out: { type: "string", description: "Check-out date in YYYY-MM-DD" },
          adults: { type: ["number", "null"], description: "Number of adults" },
          child_ages: { type: "array", items: { type: "number" }, description: "Child ages" },
          room_quantity: { type: ["number", "null"], description: "Number of rooms" },
          breakfast_preferred: { type: "boolean", description: "Whether breakfast is preferred" },
          max_total_budget: { type: ["number", "null"], description: "Maximum full-stay budget" },
          currency: { type: "string", description: "ISO currency code" },
          accessible: { type: "boolean", description: "Whether step-free access is required" },
          amenities: { type: "array", items: { type: "string" }, description: "Preferred amenities such as pool, gym or parking" },
        },
        required: ["lat", "lon", "location_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "comprehensive_safety_intelligence",
      description: "Check recent safety context from news sources and provide cautious travel guidance.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or region" },
          country: { type: "string", description: "Country or region" },
          specific_concerns: { type: "string", description: "Specific safety concern" },
        },
        required: ["location", "country"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cultural_and_travel_insights",
      description: "Get practical cultural and destination context from recent public information.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or region" },
          country: { type: "string", description: "Country or region" },
          insight_type: { type: "string", description: "Type of insight requested" },
        },
        required: ["location", "country"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "local_experiences_and_attractions",
      description: "Find attractions, activities and practical venues using Google Places with broad query fallback.",
      parameters: {
        type: "object",
        properties: {
          lat: { type: ["number", "string"], description: "Latitude coordinate" },
          lon: { type: ["number", "string"], description: "Longitude coordinate" },
          location_name: { type: "string", description: "Human-readable location name" },
          interest_type: { type: "string", description: "Interest or activity type" },
        },
        required: ["lat", "lon", "location_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "route_and_transport_planner",
      description: "Plan a route or transport options between two places using Google Routes API v2 when available, with Google Maps fallback links.",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Starting point or address" },
          destination: { type: "string", description: "Destination place or address" },
          mode: { type: "string", description: "Preferred mode: transit, walking, driving, bicycling" },
          departure_time: { type: "string", description: "Requested local departure time in HH:mm" },
          target_date: { type: "string", description: "Requested departure date in YYYY-MM-DD" },
          date_label: { type: "string", description: "Original human-readable date phrase" },
        },
        required: ["origin", "destination"],
      },
    },
  },
];

const TIMEOUTS = {
  weather: 10000,
  google_places: 9000,
  google_timezone: 5000,
  directions: 9000,
  yelp: 9000,
  news: 12000,
  advisory: 10000,
  default: 10000,
};

const RETRIES = {
  maxRetries: 2,
  baseDelay: 700,
};

const providerCircuits = new Map();
const toolExecutionContext = new AsyncLocalStorage();

async function reserveProviderCall(service) {
  const reserve = toolExecutionContext.getStore()?.reserveProviderCall;
  if (!reserve) return;
  const result = await reserve(service);
  if (result?.allowed === false) {
    const error = new Error(`Daily external-provider call budget reached before ${service}`);
    error.code = "PROVIDER_BUDGET_EXCEEDED";
    error.status = 429;
    throw error;
  }
}

function userSafeProviderError(error, fallback = "ATLAS could not complete this live check right now.") {
  const message = String(error?.message || "");
  if (error?.code === "PROVIDER_BUDGET_EXCEEDED" || /external-provider call budget|provider-call budget|call budget/i.test(message)) {
    return "ATLAS has reached today’s live-check limit for this feature. Use the fallback link if available and try again later.";
  }
  if (/api key|token|credential|authorization|forbidden|unauthorized/i.test(message)) {
    return "ATLAS could not complete this live check because the provider connection is not available right now.";
  }
  return fallback;
}

function shouldRecordProviderFailure(error) {
  if (error?.code === "ERR_CANCELED" || error?.code === "PROVIDER_BUDGET_EXCEEDED") return false;
  const status = Number(error?.status || error?.response?.status || 0);
  if (status) return status === 429 || status >= 500;
  return true;
}

function assertCircuitClosed(service) {
  const state = providerCircuits.get(service);
  if (state?.openUntil > Date.now()) throw new Error(`${service} circuit is temporarily open`);
  if (state?.openUntil) providerCircuits.delete(service);
}

function recordProviderSuccess(service) {
  providerCircuits.delete(service);
}

function recordProviderFailure(service) {
  const threshold = Math.max(2, Number(process.env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD || 4));
  const cooldown = Math.max(5000, Number(process.env.PROVIDER_CIRCUIT_COOLDOWN_MS || 60000));
  const state = providerCircuits.get(service) || { failures: 0, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= threshold) state.openUntil = Date.now() + cooldown;
  providerCircuits.set(service, state);
}

function googlePlacesKey() {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY || "";
}

function googleMapsServerKey() {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY || "";
}

function openWeatherKey() {
  return process.env.OPEN_WEATHER_KEY || process.env.OPENWEATHER_API_KEY || "";
}

function yelpKey() {
  return process.env.YELP_API_KEY || "";
}

function yelpHeaders(key = yelpKey()) {
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(" ");
}

function toNumber(value, name) {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) throw new Error(`${name} must be a valid number`);
  return n;
}

function ttlForService(service = "default") {
  if (service === "google_geocode") return Number(process.env.CACHE_GEOCODE_TTL_SECONDS || 7 * 24 * 60 * 60);
  if (service === "weather") return Number(process.env.CACHE_WEATHER_TTL_SECONDS || 15 * 60);
  if (service === "google_places") return Number(process.env.CACHE_PLACES_TTL_SECONDS || 5 * 60);
  if (service === "google_timezone") return Number(process.env.CACHE_TIMEZONE_TTL_SECONDS || 24 * 60 * 60);
  if (service === "directions") return Number(process.env.CACHE_DIRECTIONS_TTL_SECONDS || 60);
  if (service === "yelp") return Number(process.env.CACHE_YELP_TTL_SECONDS || 30 * 60);
  if (service === "news") return Number(process.env.CACHE_NEWS_TTL_SECONDS || 45 * 60);
  if (service === "advisory") return Number(process.env.CACHE_ADVISORY_TTL_SECONDS || 30 * 60);
  return Number(process.env.CACHE_DEFAULT_TTL_SECONDS || 5 * 60);
}

function safeCachePayload(url, params = {}) {
  const cleanParams = { ...params };
  for (const key of Object.keys(cleanParams)) {
    if (/key|token|secret|appid|authorization|apiKey/i.test(key)) cleanParams[key] = "[configured]";
  }
  return { url, params: cleanParams };
}

async function uncachedHttpGet(url, params = {}, service = "default", headers = {}) {
  assertCircuitClosed(service);
  try {
    await reserveProviderCall(service);
    const response = await axios.get(url, {
      params,
      headers,
      timeout: TIMEOUTS[service] || TIMEOUTS.default,
      signal: toolExecutionContext.getStore()?.signal,
      validateStatus: (status) => status < 500,
    });
    if (response.status >= 400) {
      const error = new Error(`${service} returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    recordProviderSuccess(service);
    return response.data;
  } catch (error) {
    if (shouldRecordProviderFailure(error)) recordProviderFailure(service);
    throw error;
  }
}

async function httpGet(url, params = {}, service = "default", headers = {}) {
  const key = cacheKey(`http:${service}`, safeCachePayload(url, { params, headerNames: Object.keys(headers).sort() }));
  const ttl = ttlForService(service);
  const { value } = await getOrSetCache(key, ttl, () => uncachedHttpGet(url, params, service, headers));
  return value;
}

async function uncachedHttpPost(url, body = {}, headers = {}, service = "default") {
  assertCircuitClosed(service);
  try {
    await reserveProviderCall(service);
    const response = await axios.post(url, body, {
      headers,
      timeout: TIMEOUTS[service] || TIMEOUTS.default,
      signal: toolExecutionContext.getStore()?.signal,
      validateStatus: (status) => status < 500,
    });
    if (response.status >= 400) {
      const providerMessage = response.data?.error?.message || response.data?.error_message || response.statusText;
      const error = new Error(`${service} returned HTTP ${response.status}${providerMessage ? `: ${providerMessage}` : ""}`);
      error.status = response.status;
      throw error;
    }
    recordProviderSuccess(service);
    return response.data;
  } catch (error) {
    if (shouldRecordProviderFailure(error)) recordProviderFailure(service);
    throw error;
  }
}

async function httpPost(url, body = {}, headers = {}, service = "default") {
  const key = cacheKey(`http-post:${service}`, safeCachePayload(url, { body, headers }));
  const ttl = ttlForService(service);
  const { value } = await getOrSetCache(key, ttl, () => uncachedHttpPost(url, body, headers, service));
  return value;
}

async function withRetry(fn, service = "default") {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES.maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const signal = toolExecutionContext.getStore()?.signal;
      if (signal?.aborted || error?.code === "ERR_CANCELED") throw error;
      const message = String(error.message || "");
      const status = Number(error?.status || error?.response?.status || 0);
      if ((status >= 400 && status < 500 && status !== 429) || /401|403|INVALID_REQUEST|REQUEST_DENIED/i.test(message)) break;
      if (attempt < RETRIES.maxRetries) {
        const jitter = Math.floor(Math.random() * 250);
        await new Promise((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            const cancelled = new Error("Tool request cancelled");
            cancelled.code = "ERR_CANCELED";
            reject(cancelled);
          };
          const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
          }, RETRIES.baseDelay * attempt + jitter);
          signal?.addEventListener("abort", onAbort, { once: true });
        });
      }
    }
  }
  throw lastError;
}

function googlePriceLevel(value) {
  if (typeof value === "number") return Math.max(0, Math.min(4, value));
  const text = String(value || "").toUpperCase();
  const map = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return Object.prototype.hasOwnProperty.call(map, text) ? map[text] : null;
}

function googlePriceHint(level) {
  if (level === 0) return "free/low-cost";
  if (level === null || level === undefined) return "varies";
  return "$".repeat(Math.max(1, Math.min(level, 4)));
}

function compactPlace(place = {}, locationName = "") {
  const displayName = place.displayName?.text || place.name || "Unknown place";
  const reviewCount = Number(place.userRatingCount ?? place.user_ratings_total ?? 0);
  const priceLevel = googlePriceLevel(place.priceLevel ?? place.price_level);
  const address = place.formattedAddress || place.formatted_address || place.vicinity || "";
  const mapsUrl = place.googleMapsUri || place.url || "";
  const openNow = typeof place.currentOpeningHours?.openNow === "boolean"
    ? place.currentOpeningHours.openNow
    : typeof place.opening_hours?.open_now === "boolean"
      ? place.opening_hours.open_now
      : null;
  const placeId = place.id || place.place_id || place.name || null;

  return {
    name: displayName,
    rating: place.rating || null,
    review_count: reviewCount,
    price_level: priceLevel,
    price_hint: googlePriceHint(priceLevel),
    address,
    types: (place.types || []).filter((type) => !["establishment", "point_of_interest"].includes(type)),
    open_now: openNow,
    place_id: placeId,
    source: "google_places_new",
    verified_from_google: true,
    verified_from_yelp: false,
    url: mapsUrl,
    website: place.websiteUri || "",
    phone: place.nationalPhoneNumber || "",
    business_status: place.businessStatus || "",
    latitude: place.location?.latitude ?? place.geometry?.location?.lat ?? null,
    longitude: place.location?.longitude ?? place.geometry?.location?.lng ?? null,
    location_context: locationName,
    accessibility: place.accessibilityOptions || null,
    serves_vegetarian_food: typeof place.servesVegetarianFood === "boolean" ? place.servesVegetarianFood : null,
  };
}


function isYelpPlace(place = {}) {
  return Boolean(place.url && Array.isArray(place.categories) && place.location);
}

function compactYelpPlace(place = {}, locationName = "") {
  const address = Array.isArray(place.location?.display_address)
    ? place.location.display_address.join(", ")
    : place.location?.address1 || "";

  return {
    name: place.name || "Unknown place",
    rating: place.rating || null,
    review_count: place.review_count || 0,
    price_level: null,
    price_hint: place.price || "varies",
    address,
    types: (place.categories || []).map((category) => category.title).filter(Boolean),
    open_now: null,
    place_id: place.id || null,
    source: "yelp",
    verified_from_google: false,
    verified_from_yelp: true,
    url: place.url || "",
    location_context: locationName,
  };
}

function placeName(place = {}) {
  return place.displayName?.text || place.name || "";
}

function placeAddress(place = {}) {
  return place.formattedAddress || place.formatted_address || place.vicinity || place.location?.address1 || "";
}

function placeReviewCount(place = {}) {
  return Number(place.userRatingCount ?? place.user_ratings_total ?? place.review_count ?? 0);
}

function dedupePlaces(places = []) {
  const seen = new Set();
  const out = [];
  for (const place of places) {
    const key = place.id || place.place_id || place.name || normalize(`${placeName(place)} ${placeAddress(place)}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

function rankPlaces(places = []) {
  return [...places].sort((a, b) => {
    const score = (place) => {
      const rating = Number(place.rating || 0);
      const reviews = Math.min(placeReviewCount(place), 1000) / 250;
      const openBonus = place.currentOpeningHours?.openNow || place.opening_hours?.open_now ? 0.4 : 0;
      return rating + reviews + openBonus;
    };
    return score(b) - score(a);
  });
}

const LOW_VALUE_ATTRACTION_TYPES = new Set([
  "bus_station",
  "transit_station",
  "train_station",
  "subway_station",
  "taxi_stand",
  "parking",
  "gas_station",
  "car_repair",
  "car_dealer",
  "car_rental",
  "car_wash",
  "electric_vehicle_charging_station",
  "storage",
  "airport",
]);

function isLowValueAttractionPlace(place = {}) {
  const types = Array.isArray(place.types) ? place.types : [];
  if (types.some((type) => LOW_VALUE_ATTRACTION_TYPES.has(type))) return true;
  const text = normalize(`${placeName(place)} ${placeAddress(place)}`);
  return /\b(airport\s+park|bus\s+(park|station|stop|terminal)|parking|car\s+park|taxi\s+stand|fuel\s+station|gas\s+station)\b/.test(text);
}

function rankAttractionPlaces(places = []) {
  return rankPlaces(places.filter((place) => !isLowValueAttractionPlace(place)));
}

function placeSearchText(place = {}) {
  return normalize([
    placeName(place),
    placeAddress(place),
    ...(place.types || []),
  ].filter(Boolean).join(" "));
}

const SPORTS_ACTIVITY_PATTERNS = {
  tennis: /\b(tennis|tennisplatz|tennishalle|tennisverein|tenniskentta|tenniskenttä|tennisseura|tennishalli|court de tennis|pista de tenis|campo da tennis|tennisbana|tennisbane|テニス|테니스)\b/,
  badminton: /\b(badminton|sulkapallo|sulkapallohalli|sulkapallokentta|sulkapallokenttä)\b/,
  football: /\b(football|soccer|futsal|jalkapallo|pitch|field)\b/,
  basketball: /\b(basketball|koripallo)\b/,
  volleyball: /\b(volleyball|lentopallo)\b/,
  swimming: /\b(swimming|pool|aquatic|uimahalli|uima)\b/,
  gym: /\b(gym|fitness|liikuntakeskus|kuntosali)\b/,
  padel: /\b(padel)\b/,
  pickleball: /\b(pickleball)\b/,
  squash: /\b(squash)\b/,
  golf: /\b(golf)\b/,
  climbing: /\b(climbing|bouldering|kiipeily)\b/,
  bowling: /\b(bowling|keila)\b/,
  skating: /\b(skating|skate|rink|luistelu|jäähalli|jaahalli)\b/,
  running: /\b(running|jogging|track|athletics|urheilukentta|urheilukenttä)\b/,
  sauna: /\b(sauna|saunas|saunakeskus|saunamaailma|löyly|loyly)\b/,
  sports: /\b(sport|sports|liikunta|urheilu|athletic|fitness|gym|hall|court|field|pitch|centre|center)\b/,
};

const SPORTS_VENUE_PATTERN = /\b(court|courts|club|hall|halli|liikuntahalli|urheilutalo|kentta|kenttä|keskus|centre|center|complex|stadium|arena|field|pitch|rink|track|puisto|urheilupuisto|liikuntakeskus|sports)\b/;

function placeHasActivityMatch(place = {}, activityKey = "sports") {
  const pattern = SPORTS_ACTIVITY_PATTERNS[activityKey] || SPORTS_ACTIVITY_PATTERNS.sports;
  return pattern.test(placeSearchText(place));
}

function isPlausibleTennisVenue(place = {}) {
  const text = placeSearchText(place);
  const types = new Set((place.types || []).map(normalize));
  if (placeHasActivityMatch(place, "tennis")) return true;
  if (/\b(poolbar|pool bar|billiard|biljardi|bowling|keila|pub|bar|cafe|restaurant|karaoke|night club|nightclub)\b/.test(text)) return false;
  if (types.has("bar") || types.has("restaurant") || types.has("cafe") || types.has("night_club")) return false;
  if (/\b(arena|areena|stadium|ice hockey|hockey|jaahalli|jäähalli)\b/.test(text)) return false;
  return /\b(urheilutalo|liikuntakeskus|liikuntahalli|sports hall|sports centre|sports center|sports complex)\b/.test(text)
    || types.has("sports_complex");
}

function sportsPlaceScore(place = {}, activityKey = "sports") {
  const text = placeSearchText(place);
  const types = new Set((place.types || []).map(normalize));
  let score = 0;

  const primaryPattern = SPORTS_ACTIVITY_PATTERNS[activityKey] || SPORTS_ACTIVITY_PATTERNS.sports;
  const venuePattern = SPORTS_VENUE_PATTERN;
  if (primaryPattern.test(text)) score += 8;
  if (venuePattern.test(text)) score += 3;
  if (types.has("sports_complex") || types.has("stadium") || types.has("gym") || types.has("park")) score += 2;
  if (place.rating) score += Math.min(Number(place.rating || 0), 5) / 2;
  if (placeReviewCount(place)) score += Math.min(placeReviewCount(place), 300) / 300;

  const unrelatedTypes = [
    "supermarket",
    "grocery store",
    "shopping mall",
    "department store",
    "restaurant",
    "cafe",
    "bar",
    "store",
    "gas station",
    "lodging",
  ];
  const looksRetailOrDining = unrelatedTypes.some((type) => types.has(type) || text.includes(type));
  if (looksRetailOrDining && !primaryPattern.test(text)) score -= 10;
  if (activityKey === "tennis" && !isPlausibleTennisVenue(place)) score -= 12;
  if (activityKey === "tennis" && /\bpadel\b/.test(text) && !/\btennis\b|tennis(kentta|kenttä|halli|seura)/.test(text)) score -= 4;
  if (activityKey === "tennis" && /\b(gym|fitness|kuntosali)\b/.test(text) && !/\b(tennis|tenniskentta|tenniskenttä|tennishalli|tennisseura|urheilutalo|liikuntakeskus|liikuntahalli|sports hall)\b/.test(text)) score -= 5;

  return score;
}

function rankSportsPlaces(places = [], interestType = "") {
  const activityKey = activityKeyFromText(interestType) || "sports";
  const scored = places.map((place) => ({ place, score: sportsPlaceScore(place, activityKey) }));
  const exact = scored.filter((item) => item.score >= 5);
  const usable = activityKey === "tennis"
    ? exact.filter((item) => isPlausibleTennisVenue(item.place))
    : exact.length >= 3 ? exact : scored.filter((item) => item.score >= 2);
  return usable
    .sort((a, b) => b.score - a.score)
    .map((item) => item.place);
}

const GOOGLE_PLACES_NEW_FIELD_MASK = [
  "places.id",
  "places.name",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.location",
  "places.types",
  "places.currentOpeningHours",
  "places.regularOpeningHours",
  "places.priceLevel",
  "places.businessStatus",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.accessibilityOptions",
  "places.servesVegetarianFood",
].join(",");

function readablePlaceType(type = "") {
  const map = {
    restaurant: "restaurants",
    cafe: "cafes",
    bar: "bars",
    night_club: "nightlife",
    lodging: "hotels",
    museum: "museums",
    library: "libraries",
    shopping_mall: "shopping centres",
    store: "shops",
    park: "parks",
    tourist_attraction: "tourist attractions",
    art_gallery: "art galleries",
    zoo: "zoo",
    gym: "sports centre",
    point_of_interest: "places",
  };
  return map[type] || String(type || "places").replace(/_/g, " ");
}

function textQueryForNearby({ type, keyword, locationName = "" }) {
  const parts = [];
  if (keyword) parts.push(keyword);
  if (type) parts.push(readablePlaceType(type));
  if (!parts.length) parts.push("places");
  return `${[...new Set(parts.map((item) => String(item).trim()).filter(Boolean))].join(" ")} in ${locationName}`;
}

async function placesTextSearchNew({ query, lat, lon, radius = 8000, maxResultCount = 10 }) {
  const key = googlePlacesKey();
  if (!key) throw new Error("Google Places API key is not configured");

  const body = {
    textQuery: query,
    maxResultCount: Math.max(1, Math.min(Number(maxResultCount) || 10, 20)),
  };

  const latitude = Number(lat);
  const longitude = Number(lon);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    body.locationBias = {
      circle: {
        center: { latitude, longitude },
        radius: Math.max(500, Math.min(Number(radius) || 8000, 50000)),
      },
    };
  }

  const data = await httpPost(
    "https://places.googleapis.com/v1/places:searchText",
    body,
    {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": GOOGLE_PLACES_NEW_FIELD_MASK,
    },
    "google_places"
  );

  return Array.isArray(data.places) ? data.places : [];
}

async function nearbySearch({ lat, lon, radius = 5000, type, keyword, locationName = "" }) {
  const query = textQueryForNearby({ type, keyword, locationName });
  return placesTextSearchNew({ query, lat, lon, radius, maxResultCount: 10 });
}

async function textSearch({ query, lat, lon, radius = 8000 }) {
  return placesTextSearchNew({ query, lat, lon, radius, maxResultCount: 10 });
}

async function yelpSearch({ term, lat, lon, categories = "", radius = 10000, limit = 8 }) {
  const key = yelpKey();
  if (!key) return [];

  const params = {
    term,
    latitude: lat,
    longitude: lon,
    radius: Math.min(radius, 40000),
    limit,
    sort_by: "best_match",
  };

  if (categories) params.categories = categories;

  const data = await httpGet(
    "https://api.yelp.com/v3/businesses/search",
    params,
    "yelp",
    yelpHeaders(key),
  ).catch((error) => {
    throw new Error(`Yelp ${error.message}`);
  });

  return Array.isArray(data.businesses) ? data.businesses : [];
}

function mapsSearchAction(label, query, category = "search") {
  return {
    name: label,
    category,
    address: query,
    rating: null,
    review_count: 0,
    price_hint: "",
    open_now: null,
    verified: false,
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    is_search: true,
  };
}

function conciseSearchLabel(term = "") {
  const normalized = String(term || "").replace(/\s+/g, " ").trim();
  const labels = [
    [/^public tennis courts?$/i, "Public tennis courts"],
    [/^indoor tennis courts?$/i, "Indoor tennis courts"],
    [/^tennis courts?$/i, "Tennis courts"],
    [/^tennis clubs?$/i, "Tennis club"],
    [/^sports centres? tennis$/i, "Sports centre tennis"],
    [/^community tennis court$/i, "Community tennis court"],
    [/^museums?$/i, "Museums"],
    [/^libraries$/i, "Libraries"],
    [/^shopping centres?$/i, "Shopping centres"],
    [/^parks$/i, "Parks"],
    [/^cafes?$/i, "Cafes"],
    [/^local restaurants$/i, "Local restaurants"],
  ];
  for (const [pattern, label] of labels) if (pattern.test(normalized)) return label;
  return titleCase(normalized).replace(/\bIn\b/g, "in").replace(/\bNear\b/g, "near").slice(0, 54);
}

async function runPlaceSearchPlan(plan = [], lat, lon, locationName, maxCalls = 7) {
  const all = [];
  const errors = [];
  const used = [];

  const configuredLimit = Math.max(1, Number(process.env.PLACE_SEARCH_MAX_CALLS || 5));
  const steps = plan.slice(0, Math.min(maxCalls, configuredLimit));
  const concurrency = Math.max(1, Math.min(3, Number(process.env.PLACE_SEARCH_CONCURRENCY || 3)));
  let cursor = 0;

  async function worker() {
    while (cursor < steps.length) {
      const step = steps[cursor];
      cursor += 1;
      try {
      const results = await withRetry(async () => {
        if (step.mode === "yelp") {
          return yelpSearch({ term: step.term || step.query, lat, lon, categories: step.categories || "", radius: step.radius || 12000, limit: step.limit || 8 });
        }
        if (step.mode === "text") {
          return textSearch({ query: step.query, lat, lon, radius: step.radius || 9000 });
        }
        return nearbySearch({ lat, lon, radius: step.radius || 7000, type: step.type, keyword: step.keyword, locationName });
      }, "google_places");

      const label = step.mode === "yelp"
        ? `yelp:${step.term || step.query}`
        : step.mode === "text"
        ? step.query
        : `${step.type}${step.keyword ? `:${step.keyword}` : ""}`;
      used.push(label);
      all.push(...results);
      } catch (error) {
        errors.push(error.message);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, steps.length) }, () => worker()));

  return {
    raw: rankPlaces(dedupePlaces(all)),
    used_queries: used,
    errors,
    locationName,
  };
}

const ACTIVITY_SEARCH_CONFIG = {
  tennis: {
    display: "tennis",
    terms: ["tennis courts", "public tennis courts", "indoor tennis courts", "tennis club", "sports centre tennis", "community tennis court", "tennis near", "outdoor tennis courts", "municipal tennis courts"],
    nearby: [{ type: "park", keyword: "tennis court" }, { type: "gym", keyword: "tennis" }, { type: "point_of_interest", keyword: "tennis" }],
    yelp: { term: "tennis courts", categories: "tennis,sports_clubs,active" },
  },
  badminton: {
    display: "badminton",
    terms: ["badminton courts", "badminton club", "indoor badminton", "sports hall badminton", "sports centre badminton"],
    nearby: [{ type: "gym", keyword: "badminton" }, { type: "point_of_interest", keyword: "badminton" }],
    yelp: { term: "badminton", categories: "active,sports_clubs" },
  },
  football: {
    display: "football/soccer",
    terms: ["football pitch", "soccer field", "public football field", "futsal court", "sports centre football"],
    nearby: [{ type: "park", keyword: "football pitch" }, { type: "point_of_interest", keyword: "football" }],
    yelp: { term: "football soccer field", categories: "active,sports_clubs" },
  },
  basketball: {
    display: "basketball",
    terms: ["basketball courts", "public basketball court", "indoor basketball", "sports centre basketball"],
    nearby: [{ type: "park", keyword: "basketball court" }, { type: "gym", keyword: "basketball" }],
    yelp: { term: "basketball court", categories: "active,sports_clubs" },
  },
  volleyball: {
    display: "volleyball",
    terms: ["volleyball courts", "beach volleyball", "indoor volleyball", "sports centre volleyball"],
    nearby: [{ type: "park", keyword: "volleyball" }, { type: "gym", keyword: "volleyball" }],
    yelp: { term: "volleyball court", categories: "active,sports_clubs" },
  },
  swimming: {
    display: "swimming",
    terms: ["swimming pool", "public swimming pool", "aquatic centre", "indoor swimming pool"],
    nearby: [{ type: "gym", keyword: "swimming pool" }, { type: "point_of_interest", keyword: "swimming pool" }],
    yelp: { term: "swimming pool", categories: "active" },
  },
  gym: {
    display: "gym or fitness",
    terms: ["gym", "fitness centre", "fitness center", "sports centre", "public gym"],
    nearby: [{ type: "gym", keyword: "fitness" }],
    yelp: { term: "gym fitness", categories: "gyms,active" },
  },
  padel: {
    display: "padel",
    terms: ["padel courts", "padel club", "indoor padel", "sports centre padel"],
    nearby: [{ type: "point_of_interest", keyword: "padel" }, { type: "gym", keyword: "padel" }],
    yelp: { term: "padel courts", categories: "active,sports_clubs" },
  },
  pickleball: {
    display: "pickleball",
    terms: ["pickleball courts", "public pickleball courts", "pickleball club"],
    nearby: [{ type: "park", keyword: "pickleball" }, { type: "gym", keyword: "pickleball" }],
    yelp: { term: "pickleball courts", categories: "active,sports_clubs" },
  },
  squash: {
    display: "squash",
    terms: ["squash courts", "squash club", "sports centre squash"],
    nearby: [{ type: "gym", keyword: "squash" }, { type: "point_of_interest", keyword: "squash" }],
    yelp: { term: "squash courts", categories: "active,sports_clubs" },
  },
  golf: {
    display: "golf",
    terms: ["golf course", "driving range", "golf club"],
    nearby: [{ type: "point_of_interest", keyword: "golf course" }],
    yelp: { term: "golf course", categories: "golf,active" },
  },
  climbing: {
    display: "climbing",
    terms: ["climbing gym", "bouldering gym", "indoor climbing"],
    nearby: [{ type: "gym", keyword: "climbing" }, { type: "point_of_interest", keyword: "bouldering" }],
    yelp: { term: "climbing gym", categories: "climbing,active" },
  },
  bowling: {
    display: "bowling",
    terms: ["bowling alley", "bowling centre", "bowling center"],
    nearby: [{ type: "bowling_alley" }],
    yelp: { term: "bowling alley", categories: "bowling,active" },
  },
  skating: {
    display: "skating",
    terms: ["ice skating rink", "skate park", "skating rink"],
    nearby: [{ type: "park", keyword: "skate" }, { type: "point_of_interest", keyword: "ice skating" }],
    yelp: { term: "skating rink", categories: "active" },
  },
  running: {
    display: "running",
    terms: ["running track", "athletics track", "jogging park", "park running route"],
    nearby: [{ type: "park", keyword: "running track" }, { type: "point_of_interest", keyword: "athletics track" }],
    yelp: { term: "running track", categories: "active" },
  },
  sauna: {
    display: "sauna",
    terms: ["sauna", "indoor sauna", "public sauna", "private sauna", "quiet sauna"],
    nearby: [{ type: "spa", keyword: "sauna" }, { type: "point_of_interest", keyword: "sauna" }],
    yelp: { term: "sauna", categories: "saunas,spas" },
  },
  sports: {
    display: "sports",
    terms: ["sports centre", "sports center", "sports hall", "public sports facilities", "municipal sports facilities"],
    nearby: [{ type: "gym", keyword: "sports" }, { type: "point_of_interest", keyword: "sports centre" }, { type: "park", keyword: "sports" }],
    yelp: { term: "sports facilities", categories: "active,sports_clubs,gyms" },
  },
};

function activityKeyFromText(text = "") {
  const value = normalize(text);
  const ordered = ["tennis", "badminton", "football", "basketball", "volleyball", "swimming", "gym", "padel", "pickleball", "squash", "golf", "climbing", "bowling", "skating", "running", "sauna"];
  for (const key of ordered) {
    if (key === "football" && /\b(football|soccer|futsal|pitch|soccer field)\b/.test(value)) return key;
    if (key === "swimming" && /\b(swimming|swim|pool|aquatic)\b/.test(value)) return key;
    if (key === "gym" && /\b(gym|fitness|workout)\b/.test(value)) return key;
    if (key === "climbing" && /\b(climbing|bouldering)\b/.test(value)) return key;
    if (key === "skating" && /\b(skating|skate|ice skating|rink)\b/.test(value)) return key;
    if (key === "running" && /\b(running|jogging|track)\b/.test(value)) return key;
    if (key === "sauna" && /\b(sauna|saunas|löyly|loyly)\b/.test(value)) return key;
    if (new RegExp(`\\b${key}\\b`).test(value)) return key;
  }
  if (/\b(court|courts)\b/.test(value)) return "tennis";
  if (/\b(sport|sports|play|venue|facility|facilities)\b/.test(value)) return "sports";
  return "";
}

function localizedActivityTerms(activityKey, locationName = "") {
  const loc = normalize(locationName);
  const terms = [];
  const add = (values) => terms.push(...values);

  if (/finland|suomi|riihimaki|helsinki|hyvinkaa|tampere|turku|lahti|espoo|vantaa|oulu|jyvaskyla/.test(loc)) {
    if (activityKey === "tennis") add(["tenniskenttä", "tennishalli", "tennisseura", "ulkotenniskenttä", "urheilupuisto tennis", "Riihimäen tenniskenttä", "Riihimäen Tennisseura", "tennis Riihimäki", "liikuntapalvelut tennis"]);
    if (activityKey === "badminton") add(["sulkapallokenttä", "sulkapallohalli", "liikuntahalli sulkapallo"]);
    if (activityKey === "football") add(["jalkapallokenttä", "futsal", "urheilukenttä"]);
    if (activityKey === "sports") add(["liikuntahalli", "urheilukeskus", "urheilupuisto", "liikuntapalvelut"]);
    if (activityKey === "sauna") add(["sauna", "yleinen sauna", "sisäsauna", "saunakeskus"]);
  }
  if (/sweden|stockholm|gothenburg|goteborg|malmo/.test(loc)) {
    if (activityKey === "tennis") add(["tennisbana", "tennishall", "tennisklubb"]);
    if (activityKey === "sports") add(["idrottshall", "sportcenter", "idrottsplats"]);
  }
  if (/norway|oslo|bergen|trondheim|denmark|copenhagen|kobenhavn/.test(loc)) {
    if (activityKey === "tennis") add(["tennisbane", "tennishall", "tennisklubb"]);
    if (activityKey === "sports") add(["idrettshall", "sportssenter", "idraetshal"]);
  }
  if (/germany|austria|switzerland|berlin|munich|munchen|vienna|zurich|zürich|hamburg/.test(loc)) {
    if (activityKey === "tennis") add(["Tennisplatz", "Tennishalle", "Tennisverein"]);
    if (activityKey === "sports") add(["Sportzentrum", "Sporthalle", "Sportanlage"]);
  }
  if (/france|paris|lyon|marseille|belgium|brussels|bruxelles/.test(loc)) {
    if (activityKey === "tennis") add(["court de tennis", "club de tennis"]);
    if (activityKey === "sports") add(["centre sportif", "gymnase"]);
  }
  if (/spain|mexico|madrid|barcelona|chile|argentina|colombia|peru/.test(loc)) {
    if (activityKey === "tennis") add(["pista de tenis", "club de tenis", "canchas de tenis"]);
    if (activityKey === "sports") add(["centro deportivo", "polideportivo"]);
  }
  if (/italy|rome|milan|naples/.test(loc)) {
    if (activityKey === "tennis") add(["campo da tennis", "circolo tennis"]);
    if (activityKey === "sports") add(["centro sportivo", "palazzetto dello sport"]);
  }
  if (/portugal|brazil|lisbon|porto|sao paulo|rio de janeiro/.test(loc)) {
    if (activityKey === "tennis") add(["quadra de tênis", "clube de tênis"]);
    if (activityKey === "sports") add(["centro esportivo", "pavilhão desportivo"]);
  }
  if (/japan|tokyo|osaka|kyoto/.test(loc)) {
    if (activityKey === "tennis") add(["テニスコート", "テニスクラブ"]);
    if (activityKey === "sports") add(["スポーツセンター", "体育館"]);
  }
  if (/south korea|korea|seoul|busan/.test(loc)) {
    if (activityKey === "tennis") add(["테니스장", "테니스 클럽"]);
    if (activityKey === "sports") add(["스포츠 센터", "체육관"]);
  }
  if (/turkey|istanbul|ankara|antalya/.test(loc)) {
    if (activityKey === "tennis") add(["tenis kortu", "tenis kulübü"]);
    if (activityKey === "sports") add(["spor salonu", "spor merkezi"]);
  }

  return [...new Set(terms)];
}

function activitySearchTerms(interestType = "attractions", locationName = "") {
  const activityKey = activityKeyFromText(interestType) || "";
  const config = ACTIVITY_SEARCH_CONFIG[activityKey] || null;
  if (!config) return [];
  const generic = config.terms || [];
  const localized = localizedActivityTerms(activityKey, locationName);
  return [...new Set([...generic, ...localized])];
}

function activitySpecificSuggestions(interestType = "", locationName = "") {
  const terms = activitySearchTerms(interestType, locationName);
  if (terms.length) return terms.slice(0, 6);

  const text = normalize(interestType);
  if (/top attractions|local experiences|general travel|things to do|attractions/.test(text)) {
    return ["museums", "libraries", "shopping centres", "parks", "cafes"];
  }

  return ["things to do", "activity venues", "official tourism pages", "parks", "visitor centres"];
}

function activityPlan(interestType = "attractions", locationName = "", plannerQueries = []) {
  const text = normalize(interestType);
  const plan = [];
  const add = (step) => plan.push(step);
  const activityKey = activityKeyFromText(text);
  const config = ACTIVITY_SEARCH_CONFIG[activityKey];

  if (config) {
    const terms = [...new Set([...plannerQueries.filter(Boolean), ...activitySearchTerms(text, locationName)])];
    for (const term of terms) {
      add({ mode: "text", query: `${term} in ${locationName}`.replace(/tennis near in/i, "tennis near"), radius: /public|municipal|community|park|kenttä|bana|pista|quadra|court|tennis|halli|seura/i.test(term) ? 30000 : 16000 });
    }
    for (const nearby of config.nearby || []) add({ mode: "nearby", ...nearby, radius: 25000 });
    if (config.yelp) add({ mode: "yelp", term: `${config.yelp.term} ${locationName}`, categories: config.yelp.categories || "active" });
    return plan;
  }

  for (const query of plannerQueries.filter(Boolean).slice(0, 5)) {
    add({ mode: "text", query: /\bin\s+/i.test(query) ? query : `${query} in ${locationName}`, radius: 16000 });
  }

  if (/\b(accessible|accessibility|wheelchair|senior|minimal walking|limited walking)\b/.test(text)
    || (/\b(indoor|rain)\b/.test(text) && /\b(museum|library|cultural|attraction)\b/.test(text))) {
    add({ mode: "text", query: `accessible indoor museums in ${locationName}` });
    add({ mode: "text", query: `accessible cultural attractions in ${locationName}` });
    add({ mode: "text", query: `libraries in ${locationName}` });
    add({ mode: "nearby", type: "museum" });
    add({ mode: "nearby", type: "library" });
    return plan;
  }

  if (/baby|family|child|kid|indoor playground|stroller/.test(text)) {
    add({ mode: "text", query: `indoor playground in ${locationName}` });
    add({ mode: "text", query: `family activities in ${locationName}` });
    add({ mode: "nearby", type: "museum" });
    add({ mode: "nearby", type: "library" });
    add({ mode: "nearby", type: "shopping_mall" });
    add({ mode: "nearby", type: "cafe", keyword: "family" });
    add({ mode: "nearby", type: "restaurant", keyword: "family friendly" });
    add({ mode: "nearby", type: "park" });
    add({ mode: "yelp", term: `family friendly places ${locationName}`, categories: "kids_activities,museums,playgrounds,cafes" });
    return plan;
  }

  if (/hiking|trek|nature|outdoor|wildlife|park|safari/.test(text)) {
    add({ mode: "nearby", type: "park" });
    add({ mode: "nearby", type: "tourist_attraction", keyword: "nature" });
    add({ mode: "nearby", type: "zoo" });
    add({ mode: "text", query: `hiking trails near ${locationName}` });
    add({ mode: "text", query: `nature attractions near ${locationName}` });
    return plan;
  }

  if (/\b(old town|historic centre|historic center)\b/.test(text)) {
    add({ mode: "text", query: `old town landmarks in ${locationName}` });
    add({ mode: "text", query: `museums in ${locationName}` });
    add({ mode: "text", query: `historic attractions in ${locationName}` });
    add({ mode: "nearby", type: "tourist_attraction", keyword: "historic old town" });
    return plan;
  }

  if (/culture|museum|art|history|heritage|temple|church|monument/.test(text)) {
    add({ mode: "nearby", type: "museum" });
    add({ mode: "nearby", type: "art_gallery" });
    add({ mode: "nearby", type: "tourist_attraction", keyword: "historic" });
    add({ mode: "nearby", type: "library" });
    return plan;
  }

  if (/shopping|mall|market|store/.test(text)) {
    add({ mode: "nearby", type: "shopping_mall" });
    add({ mode: "nearby", type: "store" });
    add({ mode: "text", query: `markets in ${locationName}` });
    return plan;
  }

  if (/nightlife|bar|club|pub/.test(text)) {
    add({ mode: "nearby", type: "bar" });
    add({ mode: "nearby", type: "night_club" });
    add({ mode: "text", query: `nightlife in ${locationName}` });
    return plan;
  }

  add({ mode: "nearby", type: "tourist_attraction" });
  add({ mode: "nearby", type: "museum" });
  add({ mode: "nearby", type: "park" });
  add({ mode: "nearby", type: "shopping_mall" });
  add({ mode: "text", query: `things to do in ${locationName}` });
  return plan;
}

function restaurantPlan(cuisine = "local traditional", locationName = "") {
  const text = normalize(cuisine);
  const plan = [];
  const pushText = (query) => plan.push({ mode: "text", query });
  const pushNearby = (type, keyword = "") => plan.push({ mode: "nearby", type, keyword });

  if (/nightlife|bar|pub|night club|nightclub|club/.test(text)) {
    pushText(`best bars in ${locationName}`);
    pushText(`pubs in ${locationName}`);
    pushText(`night clubs in ${locationName}`);
    pushText(`nightlife in ${locationName}`);
    pushNearby("bar");
    pushNearby("night_club");
    plan.push({ mode: "yelp", term: `bars nightlife ${locationName}`, categories: "bars,nightlife" });
    return plan;
  }

  if (/cafe|cafes|coffee/.test(text)) {
    pushText(`cafes in ${locationName}`);
    pushText(`coffee shops in ${locationName}`);
    pushText(`local cafes in ${locationName}`);
    pushNearby("cafe");
    plan.push({ mode: "yelp", term: `cafes coffee ${locationName}`, categories: "cafes,coffee" });
    return plan;
  }

  if (/street food|food stall|night market|cheap|budget/.test(text)) {
    pushText(`street food in ${locationName}`);
    pushText(`food markets in ${locationName}`);
    pushText(`cheap local food in ${locationName}`);
    plan.push({ mode: "yelp", term: `street food ${locationName}`, categories: "streetvendors,foodstands,foodtrucks" });
    return plan;
  }

  if (/vegetarian|vegan|plant based|halal|kosher|gluten free|gluten-free/.test(text)) {
    pushText(`${cuisine} restaurants in ${locationName}`);
    if (/vegetarian|vegan|plant based/.test(text)) pushText(`vegetarian vegan restaurants in ${locationName}`);
    if (/halal/.test(text)) pushText(`halal certified restaurants in ${locationName}`);
    if (/kosher/.test(text)) pushText(`kosher restaurants in ${locationName}`);
    if (/gluten free|gluten-free/.test(text)) pushText(`gluten free restaurants in ${locationName}`);
    plan.push({ mode: "yelp", term: `${cuisine} restaurants ${locationName}`, categories: "vegetarian,vegan,restaurants" });
    return plan;
  }

  const keyword = text.includes("local") || text.includes("traditional") ? "traditional local" : cuisine;
  pushText(`${keyword} restaurants in ${locationName}`);
  pushNearby("restaurant", keyword);
  pushNearby("restaurant");
  pushNearby("cafe");
  if (/vegetarian|vegan/.test(text)) pushText(`vegetarian vegan restaurants in ${locationName}`);
  if (/street|cheap|budget|local/.test(text)) pushText(`cheap local food in ${locationName}`);
  if (/family|baby|child|kid/.test(text)) pushText(`family friendly restaurants in ${locationName}`);
  plan.push({ mode: "yelp", term: `${keyword} restaurants ${locationName}`, categories: "restaurants,cafes" });
  return plan;
}

function accommodationPlan(budget = "budget", stayType = "hotel", locationName = "", preferences = {}) {
  const text = normalize(`${budget} ${stayType}`);
  const plan = [];
  const pushText = (query) => plan.push({ mode: "text", query });
  const pushLodging = (keyword = "") => plan.push({ mode: "nearby", type: "lodging", keyword });
  const area = normalize(preferences.preferred_area || "");
  const areaPhrase = area ? `${preferences.preferred_area} ` : "";
  const family = Number(preferences.adults || 0) > 0 && Array.isArray(preferences.child_ages) && preferences.child_ages.length > 0;
  const preferenceTerms = [
    preferences.accessible ? "wheelchair accessible step-free" : "",
    ...(Array.isArray(preferences.amenities) ? preferences.amenities : []),
  ].filter(Boolean).join(" ");

  if (family) {
    if (preferenceTerms) pushText(`${areaPhrase}family hotels ${preferenceTerms} in ${locationName}`);
    pushText(`${areaPhrase}family hotels in ${locationName}`);
    pushText(`${areaPhrase}hotels with family rooms in ${locationName}`);
    pushText(`${areaPhrase}aparthotels in ${locationName}`);
    if (preferences.breakfast_preferred) pushText(`${areaPhrase}family hotels with breakfast in ${locationName}`);
    if (/cheap|budget|affordable|low cost|low-cost|\$/.test(text)) pushText(`${areaPhrase}budget family hotels in ${locationName}`);
    pushLodging("family hotel");
    return plan;
  }

  if (/hostel|backpacker/.test(text)) {
    pushText(`hostels in ${locationName}`);
    pushText(`backpacker hostels in ${locationName}`);
    pushText(`budget hostels in ${locationName}`);
    pushLodging("hostel budget");
  } else if (/motel/.test(text)) {
    pushText(`motels in ${locationName}`);
    pushText(`roadside motels in ${locationName}`);
    pushLodging("motel");
  } else if (/lodge|guesthouse|guest house|homestay/.test(text)) {
    pushText(`guesthouses in ${locationName}`);
    pushText(`lodges in ${locationName}`);
    pushText(`homestays in ${locationName}`);
    pushLodging("guesthouse lodge homestay");
  } else if (/apartment|serviced apartment|flat/.test(text)) {
    pushText(`serviced apartments in ${locationName}`);
    pushText(`apartment hotels in ${locationName}`);
    pushLodging("serviced apartment");
  } else if (/luxury|premium|resort|5 star|five star|expensive/.test(text)) {
    pushText(`luxury hotels in ${locationName}`);
    pushText(`5 star hotels in ${locationName}`);
    pushText(`resorts in ${locationName}`);
    pushLodging("luxury hotel resort");
  } else if (/cheap|budget|affordable|low cost|low-cost|\$/.test(text)) {
    pushText(`hostels in ${locationName}`);
    pushText(`guesthouses in ${locationName}`);
    pushText(`budget hotels in ${locationName}`);
    pushText(`cheap hotels in ${locationName}`);
    pushLodging("hostel guesthouse budget");
  } else {
    pushText(`${stayType || "hotel"} in ${locationName}`);
    pushText(`well rated hotels in ${locationName}`);
    pushLodging();
  }

  pushLodging();
  return plan;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const [aLat, aLon, bLat, bLon] = values.map((value) => value * Math.PI / 180);
  const dLat = bLat - aLat;
  const dLon = bLon - aLon;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function highEndHotelName(name = "") {
  return /\b(radisson|marriott|hyatt|hilton|sheraton|intercontinental|crowne|autograph|soaltee|shanker|palace|resort|luxury|ritz|four seasons|mandarin oriental)\b/i.test(String(name));
}

function budgetAccommodationScore(place = {}) {
  const name = String(placeName(place) || "");
  const types = Array.isArray(place.types) ? place.types.join(" ").toLowerCase() : "";
  let score = 0;
  if (/hostel|guesthouse|guest house|homestay|backpacker|budget|inn|lodge|bnb/i.test(name)) score += 8;
  if (/lodging|campground/.test(types)) score += 2;
  if (place.price_level === 1) score += 4;
  if (place.price_level === 0 || place.price_level == null) score += 1;
  if (place.rating >= 4) score += 1;
  if (highEndHotelName(name)) score -= 12;
  if (place.price_level >= 3) score -= 8;
  return score;
}

function filterAndRankAccommodation(places = [], budget = "budget") {
  const text = normalize(budget);
  let ranked = [...places];

  if (/cheap|budget|hostel|guesthouse|guest house|homestay|\$/.test(text)) {
    ranked = ranked
      .filter((place) => !highEndHotelName(placeName(place)))
      .sort((a, b) => budgetAccommodationScore(b) - budgetAccommodationScore(a));
  } else {
    ranked = rankPlaces(ranked);
  }

  return ranked.slice(0, 10);
}

function dataNote(status, note, extra = {}) {
  return {
    status,
    verified: status === "verified",
    note,
    ...extra,
  };
}

function noPlacesResult(locationName, category, suggestions = []) {
  const searchActions = suggestions.slice(0, 5).map((term) =>
    mapsSearchAction(conciseSearchLabel(term), /\bin\s+/i.test(term) ? term : `${term} in ${locationName}`, "search")
  );

  return {
    location: locationName,
    recommendations: [],
    search_actions: searchActions,
    data_quality: dataNote(
      "limited",
      `ATLAS could not verify ${category} matches for this exact request. Do not present specific venue names as verified live results unless they appear in another reliable source.`,
      { fallback_suggestions: suggestions }
    ),
    planning_tips: "Use the live map searches as a next step, then confirm opening hours, accessibility, prices and recent reviews before going.",
  };
}

function getWeatherAdvice(temp, condition) {
  if (condition === "Thunderstorm") return "Keep outdoor plans flexible and watch for local alerts.";
  if (condition === "Rain") return "Plan covered alternatives and carry rain protection.";
  if (temp < 5) return "Dress warmly and keep outdoor activities short.";
  if (temp > 28) return "Plan shade, hydration and lighter outdoor activity during the hottest hours.";
  return "Generally workable travel weather with normal planning.";
}

function getClothingAdvice(temp, condition) {
  const items = [];
  if (temp < 0) items.push("winter layers");
  else if (temp < 10) items.push("warm jacket");
  else if (temp < 18) items.push("light jacket or sweater");
  else items.push("comfortable breathable clothing");
  if (["Rain", "Thunderstorm", "Snow"].includes(condition)) items.push("weatherproof outer layer");
  return items.join(", ");
}

function weatherAlerts(current, forecast) {
  const alerts = [];
  const temp = Number(current?.main?.temp);
  if (temp > 32) alerts.push("High temperature: plan hydration and shade.");
  if (temp < -10) alerts.push("Very cold conditions: limit unnecessary exposure.");
  if (current?.wind?.speed > 15) alerts.push("Strong wind: be careful with exposed outdoor areas.");
  if ((forecast?.list || []).slice(0, 4).some((item) => ["Thunderstorm", "Snow"].includes(item.weather?.[0]?.main))) {
    alerts.push("Possible severe weather in the next hours.");
  }
  return alerts.length ? alerts : ["No severe weather alerts detected from the returned forecast data."];
}

function forecastLocalDate(item = {}, timezoneSeconds = 0) {
  if (!item?.dt) return "";
  return new Date((Number(item.dt) + Number(timezoneSeconds || 0)) * 1000).toISOString().slice(0, 10);
}

function formatForecastItem(item = {}, timezoneSeconds = 0) {
  const shifted = new Date((Number(item.dt) + Number(timezoneSeconds || 0)) * 1000);
  return {
    time: shifted.toLocaleString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", weekday: "short", day: "2-digit", month: "short" }),
    temperature: Math.round(item.main.temp),
    description: item.weather?.[0]?.description || "forecast unavailable",
    rain_probability: Math.round((item.pop || 0) * 100),
    wind_speed: Math.round((item.wind?.speed || 0) * 3.6),
  };
}

function localTimeFromTimeZone(timeZoneId = "", timestampSeconds = Date.now() / 1000) {
  if (!timeZoneId) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZoneId,
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(Number(timestampSeconds) * 1000));
  } catch {
    return "";
  }
}

async function googleTimeZone({ lat, lon, timestampSeconds = Math.floor(Date.now() / 1000) }) {
  const key = googleMapsServerKey();
  if (!key) return null;

  const data = await withRetry(
    () => httpGet(
      "https://maps.googleapis.com/maps/api/timezone/json",
      { location: `${lat},${lon}`, timestamp: timestampSeconds, key },
      "google_timezone",
    ),
    "google_timezone",
  );

  if (data?.status !== "OK") {
    const message = data?.errorMessage || data?.status || "unknown Time Zone API response";
    throw new Error(`Google Time Zone API returned ${message}`);
  }

  return {
    time_zone_id: data.timeZoneId || "",
    time_zone_name: data.timeZoneName || "",
    raw_offset_seconds: Number(data.rawOffset || 0),
    dst_offset_seconds: Number(data.dstOffset || 0),
    local_time: localTimeFromTimeZone(data.timeZoneId, timestampSeconds),
    source: "google_timezone_api",
  };
}

async function weatherTool({ latitude, longitude, location_name, target_date = "", date_label = "" }) {
  const lat = toNumber(latitude, "latitude");
  const lon = toNumber(longitude, "longitude");
  const key = openWeatherKey();
  if (!key) throw new Error("OpenWeather API key is not configured");
  const timestampSeconds = Math.floor(Date.now() / 1000);

  const [current, forecast, timezoneResult] = await Promise.all([
    withRetry(() => httpGet("https://api.openweathermap.org/data/2.5/weather", { lat, lon, appid: key, units: "metric" }, "weather"), "weather"),
    withRetry(() => httpGet("https://api.openweathermap.org/data/2.5/forecast", { lat, lon, appid: key, units: "metric" }, "weather"), "weather"),
    googleTimeZone({ lat, lon, timestampSeconds }).catch((error) => {
      logger.debug("Google Time Zone lookup skipped", { reason: error.message });
      return null;
    }),
  ]);

  if (!current?.main || !current?.weather?.length) throw new Error("Weather API returned incomplete current conditions");

  const condition = current.weather[0].main;
  const temp = current.main.temp;
  const timezoneSeconds = forecast?.city?.timezone || current?.timezone || 0;
  const allForecast = forecast.list || [];
  let scopedForecast = allForecast;
  let matchedTargetDate = false;

  if (target_date) {
    const exact = allForecast.filter((item) => forecastLocalDate(item, timezoneSeconds) === target_date);
    if (exact.length) {
      scopedForecast = exact;
      matchedTargetDate = true;
    } else {
      scopedForecast = [];
    }
  }

  return {
    location: location_name,
    current_conditions: {
      temperature: Math.round(temp),
      feels_like: Math.round(current.main.feels_like),
      humidity: current.main.humidity,
      description: current.weather[0].description,
      wind_speed: Math.round((current.wind?.speed || 0) * 3.6),
      visibility_km: current.visibility ? Math.round(current.visibility / 1000) : null,
    },
    forecast_scope: {
      target_date: target_date || "",
      target_label: date_label || "",
      matched_target_date: target_date ? matchedTargetDate : true,
      timezone_offset_seconds: timezoneSeconds,
    },
    local_time: timezoneResult,
    hourly_forecast: scopedForecast.slice(0, target_date ? 10 : 8).map((item) => formatForecastItem(item, timezoneSeconds)),
    travel_recommendations: {
      best_approach: getWeatherAdvice(temp, condition),
      clothing: getClothingAdvice(temp, condition),
      alerts: weatherAlerts(current, forecast),
    },
    data_quality: dataNote(
      target_date && !matchedTargetDate ? "limited" : "verified",
      target_date && !matchedTargetDate
        ? "ATLAS found current conditions, but the available 5-day forecast did not include the requested target date. Ask the user to check again closer to the activity."
        : "ATLAS verified current weather and forecast data for the resolved coordinates. Wind values are converted from m/s to km/h.",
      { source: timezoneResult ? "openweather_and_google_timezone_api" : "openweather", updated_at: new Date().toISOString() }
    ),
  };
}

async function restaurantTool({ lat, lon, location_name, cuisine_preference = "local traditional", budget_level = "any" }) {
  const latitude = toNumber(lat, "lat");
  const longitude = toNumber(lon, "lon");
  const plan = restaurantPlan(cuisine_preference, location_name);
  const { raw, used_queries, errors } = await runPlaceSearchPlan(plan, latitude, longitude, location_name, 5);

  if (!raw.length) {
    return {
      ...noPlacesResult(location_name, "restaurant", ["local restaurants", "cafes", "food markets", "hotel-recommended dining", "recently reviewed places near your stay"]),
      cuisine_focus: cuisine_preference,
      dining_tips: "For dining decisions, prioritize recent reviews, hygiene comments, opening hours and distance from your accommodation.",
      search_metadata: { used_queries, errors: errors.slice(0, 3), source: "google_places_new" },
    };
  }

  let restaurants = raw;
  const budget = normalize(budget_level);
  const cuisineText = normalize(cuisine_preference);
  if (/\bvegetarian\b/.test(cuisineText)) {
    restaurants = restaurants.filter((place) => (
      place.servesVegetarianFood === true
      || /\b(vegetarian|vegan|plant based|plant-based)\b/i.test(placeName(place))
    ));
  } else if (/\bvegan\b/.test(cuisineText)) {
    restaurants = restaurants.filter((place) => /\b(vegan|plant based|plant-based)\b/i.test(placeName(place)));
  } else if (/\bhalal\b/.test(cuisineText)) {
    restaurants = restaurants.filter((place) => /\bhalal\b/i.test(placeName(place)));
  } else if (/\bkosher\b/.test(cuisineText)) {
    restaurants = restaurants.filter((place) => /\bkosher\b/i.test(placeName(place)));
  }
  if (!/cafe|coffee|nightlife|bar|pub|club/.test(cuisineText)) {
    restaurants = restaurants.filter((place) => {
      const types = new Set((place.types || []).map(normalize));
      const text = placeSearchText(place);
      const name = normalize(placeName(place));
      if (/\b(cafe|coffee|bar|pub)\b/.test(name) && !/\brestaurant|lokanta|kebap|kebab|ocakbasi|ocakbaşı|meyhane\b/.test(name)) return false;
      const isCafeOrBarOnly = (types.has("cafe") || types.has("bar") || types.has("night club") || /\b(cafe|coffee|bar|pub)\b/.test(text)) && !types.has("restaurant") && !/\brestaurant|lokanta|kebap|kebab|ocakbasi|ocakbaşı|meyhane\b/.test(text);
      return !isCafeOrBarOnly;
    });
  }
  if (/budget|cheap/.test(budget)) restaurants = restaurants.filter((r) => !r.price_level || r.price_level <= 2);
  if (/premium|luxury/.test(budget)) restaurants = restaurants.filter((r) => !r.price_level || r.price_level >= 2);
  restaurants = rankPlaces(restaurants).slice(0, 8);

  return {
    location: location_name,
    cuisine_focus: cuisine_preference,
    restaurants: restaurants.map((place) => isYelpPlace(place) ? compactYelpPlace(place, location_name) : compactPlace(place, location_name)),
    search_actions: restaurantPlan(cuisine_preference, location_name)
      .filter((step) => step.mode === "text")
      .slice(0, 5)
      .map((step) => mapsSearchAction(conciseSearchLabel(step.query.replace(new RegExp(`\\s+in\\s+${location_name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}$`, "i"), "")), step.query, "restaurant")),
    dining_tips: "Use this as an ATLAS shortlist. Confirm opening hours, current menu and reservation needs before going.",
    data_quality: dataNote("verified", "ATLAS verified restaurant names, ratings and available open-status signals. These can change, so confirm before visiting.", { source: yelpKey() ? "google_places_new_and_yelp_api" : "google_places_new" }),
    search_metadata: { total_found: restaurants.length, used_queries, source: yelpKey() ? "google_places_new_and_yelp_api" : "google_places_new" },
  };
}

async function accommodationTool({
  lat,
  lon,
  location_name,
  budget_category = "budget",
  stay_type = "hotel",
  preferred_area = "",
  check_in = "",
  check_out = "",
  adults = null,
  child_ages = [],
  room_quantity = null,
  breakfast_preferred = false,
  max_total_budget = null,
  currency = "",
  accessible = false,
  amenities = [],
}) {
  const latitude = toNumber(lat, "lat");
  const longitude = toNumber(lon, "lon");
  const preferences = {
    preferred_area,
    check_in,
    check_out,
    adults,
    child_ages: Array.isArray(child_ages) ? child_ages : [],
    room_quantity,
    breakfast_preferred,
    max_total_budget,
    currency,
    accessible: Boolean(accessible),
    amenities: Array.isArray(amenities) ? amenities : [],
  };
  const plan = accommodationPlan(budget_category, stay_type, location_name, preferences);
  const { raw, used_queries, errors } = await runPlaceSearchPlan(plan, latitude, longitude, location_name, 6);

  if (!raw.length) {
    return {
      location: location_name,
      accommodation_type: stay_type,
      properties: [],
      data_quality: dataNote(
        "limited",
        "ATLAS could not verify accommodation matches for this exact request. Do not present hotel names as verified live options.",
        { fallback_suggestions: ["hostels", "guesthouses", "homestays", "simple hotels", "apartments with recent reviews"] }
      ),
      booking_insights: "Confirm final nightly prices, taxes, cancellation policy and recent reviews on booking platforms for your exact dates.",
      search_metadata: { used_queries, errors: errors.slice(0, 3), source: "google_places_new" },
    };
  }

  const centralFocus = /\b(central|city centre|city center|historic centre|historic center|old town)\b/i.test(preferred_area);
  const maxDistanceKm = centralFocus ? 5 : 25;
  const spatiallyRelevant = raw.filter((place) => {
    const placeLat = place.location?.latitude ?? place.geometry?.location?.lat;
    const placeLon = place.location?.longitude ?? place.geometry?.location?.lng;
    const distance = distanceKm(latitude, longitude, placeLat, placeLon);
    return distance == null || distance <= maxDistanceKm;
  });
  const ranked = filterAndRankAccommodation(spatiallyRelevant, budget_category);
  return {
    location: location_name,
    accommodation_type: stay_type,
    budget_range: budget_category,
    properties: ranked.map((place) => compactPlace(place, location_name)),
    search_actions: accommodationPlan(budget_category, stay_type, location_name, preferences)
      .filter((step) => step.mode === "text")
      .slice(0, 5)
      .map((step) => mapsSearchAction(conciseSearchLabel(step.query.replace(new RegExp(`\\s+in\\s+${location_name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}$`, "i"), "")), step.query, "stay")),
    booking_insights: "ATLAS can verify property discovery details, but not guaranteed live booking prices. Confirm exact nightly rates, taxes and availability on booking platforms or property websites.",
    data_quality: dataNote("verified", "ATLAS verified accommodation names and ratings; live room prices and availability were not available.", { source: "google_places_new", live_prices_available: false }),
    request_scope: {
      check_in: check_in || null,
      check_out: check_out || null,
      adults: Number(adults) || null,
      child_ages: preferences.child_ages,
      room_quantity: Number(room_quantity) || null,
      breakfast_preferred: Boolean(breakfast_preferred),
      max_total_budget: Number(max_total_budget) || null,
      currency: currency || null,
      preferred_area: preferred_area || null,
      accessible: Boolean(accessible),
      amenities: preferences.amenities,
    },
    search_metadata: { total_found: ranked.length, used_queries, source: "google_places_new" },
  };
}

async function attractionsTool({ lat, lon, location_name, interest_type = "attractions", planner_queries = [], planner_map_searches = [] }) {
  const latitude = toNumber(lat, "lat");
  const longitude = toNumber(lon, "lon");
  const plan = activityPlan(interest_type, location_name, planner_queries);
  const { raw, used_queries, errors } = await runPlaceSearchPlan(plan, latitude, longitude, location_name, 9);

  if (!raw.length) {
    const suggestions = planner_map_searches.length ? planner_map_searches : activitySpecificSuggestions(interest_type, location_name);
    return {
      ...noPlacesResult(location_name, activityKeyFromText(interest_type) || "activity or attraction", suggestions),
      experience_category: interest_type,
      search_metadata: { used_queries, errors: errors.slice(0, 3), source: "google_places_new" },
    };
  }

  const normalizedInterest = normalize(interest_type);
  const isSportsRequest = /tennis|court|sports|badminton|football|soccer|basketball|volleyball|swimming|gym|fitness|padel|pickleball|squash|golf|climbing|bowling|skating|running|sauna/.test(normalizedInterest);
  const needsIndoorEvidence = /\bindoor\b/.test(normalizedInterest);
  const needsCompactArea = /\b(minimal walking|limited walking|compact)\b/.test(normalizedInterest);
  const compactCandidates = needsCompactArea
    ? raw.filter((place) => {
        const placeLat = place.location?.latitude ?? place.geometry?.location?.lat;
        const placeLon = place.location?.longitude ?? place.geometry?.location?.lng;
        const distance = distanceKm(latitude, longitude, placeLat, placeLon);
        return distance == null || distance <= 1.75;
      })
    : raw;
  const spatialPool = compactCandidates.length ? compactCandidates : raw;
  const indoorCandidates = needsIndoorEvidence
    ? spatialPool.filter((place) => /\b(museum|library|art gallery|art_gallery|shopping mall|shopping_mall)\b/.test(placeSearchText(place)))
    : [];
  const rankingPool = indoorCandidates.length ? indoorCandidates : spatialPool;
  const rankedPlaces = isSportsRequest ? rankSportsPlaces(rankingPool, interest_type) : rankAttractionPlaces(rankingPool);
  if (!rankedPlaces.length && isSportsRequest) {
    const suggestions = planner_map_searches.length ? planner_map_searches : activitySpecificSuggestions(interest_type, location_name);
    return {
      ...noPlacesResult(location_name, activityKeyFromText(interest_type) || "sports venue", suggestions),
      experience_category: interest_type,
      search_metadata: { used_queries, errors: errors.slice(0, 3), source: "google_places_new" },
    };
  }

  const recommendations = rankedPlaces.slice(0, 10).map((place) => ({
    ...(isYelpPlace(place) ? compactYelpPlace(place, location_name) : compactPlace(place, location_name)),
    category: (place.types || []).filter((type) => !["establishment", "point_of_interest"].includes(type)).join(", ") || interest_type,
    why_visit: place.rating >= 4 ? "Highly rated by travellers" : "Relevant local option found by ATLAS",
  }));

  return {
    location: location_name,
    experience_category: interest_type,
    recommendations,
    search_actions: (planner_map_searches.length ? planner_map_searches : activitySpecificSuggestions(interest_type, location_name)).slice(0, 5).map((term) => mapsSearchAction(conciseSearchLabel(term), /\bin\s+/i.test(term) ? term : `${term} in ${location_name}`, "search")),
    planning_tips: isSportsRequest
      ? "Use this as an ATLAS discovery shortlist. ATLAS usually cannot confirm whether a court is free or reservable, so check the municipality, club website or venue phone number before going."
      : "Use this as an ATLAS discovery shortlist. Check opening hours, stroller access, booking rules and recent reviews before visiting.",
    data_quality: dataNote("verified", isSportsRequest
      ? "ATLAS verified venue discovery details. Free/public access cannot be guaranteed from place data alone."
      : "ATLAS verified activity and venue discovery details. Suitability details such as baby facilities or accessibility should still be checked directly.", { source: yelpKey() ? "google_places_new_and_yelp_api" : "google_places_new" }),
    search_metadata: { total_found: recommendations.length, used_queries, source: yelpKey() ? "google_places_new_and_yelp_api" : "google_places_new" },
  };
}


function mapsDirectionsUrl(origin = "", destination = "", mode = "transit") {
  const travelmode = ["driving", "walking", "bicycling", "transit"].includes(mode) ? mode : "transit";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${encodeURIComponent(travelmode)}`;
}

function durationText(value = "") {
  const seconds = Number.parseFloat(String(value).replace(/s$/, ""));
  if (!Number.isFinite(seconds)) return "duration unavailable";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
}

function distanceText(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "distance unavailable";
  return value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
}

function localizedTransitTime(value = {}) {
  return value?.time?.text || "";
}

function compactTransitInstruction(step = {}) {
  const details = step.transitDetails || {};
  if (!details.transitLine && !details.stopDetails) return "";
  const line = details.transitLine?.nameShort || details.transitLine?.name || details.tripShortText || "transit";
  const headsign = details.headsign ? ` toward ${details.headsign}` : "";
  const departureStop = details.stopDetails?.departureStop?.name || "";
  const arrivalStop = details.stopDetails?.arrivalStop?.name || "";
  const departureTime = localizedTransitTime(details.localizedValues?.departureTime);
  const arrivalTime = localizedTransitTime(details.localizedValues?.arrivalTime);
  const stopText = Number.isFinite(Number(details.stopCount)) ? `, ${details.stopCount} stop${Number(details.stopCount) === 1 ? "" : "s"}` : "";
  const timeText = [departureTime, arrivalTime].filter(Boolean).join(" → ");
  const stationText = departureStop && arrivalStop ? ` from ${departureStop} to ${arrivalStop}` : "";
  return `Take ${line}${headsign}${stationText}${stopText}${timeText ? ` (${timeText})` : ""}`;
}

function compactRouteLeg(route = {}, origin = "", destination = "") {
  const leg = route.legs?.[0] || {};
  const steps = (leg.steps || []).map((step) => {
    const transitInstruction = compactTransitInstruction(step);
    return {
      instruction: transitInstruction || String(step.navigationInstruction?.instructions || "").replace(/\s+/g, " ").trim(),
      distance: distanceText(step.distanceMeters),
      duration: durationText(step.staticDuration),
      travel_mode: step.travelMode || "",
      transit_line: step.transitDetails?.transitLine?.nameShort || step.transitDetails?.transitLine?.name || "",
      is_transit: Boolean(step.transitDetails || step.travelMode === "TRANSIT"),
    };
  }).filter((step) => step.instruction);
  const transitStepCount = steps.filter((step) => step.is_transit).length;
  const walkingMeters = (leg.steps || [])
    .filter((step) => step.travelMode === "WALK")
    .reduce((sum, step) => sum + Number(step.distanceMeters || 0), 0);

  return {
    summary: route.description || "Suggested route",
    distance: distanceText(route.distanceMeters),
    duration: durationText(route.duration),
    start_address: origin,
    end_address: destination,
    steps: steps.slice(0, 12),
    transit_step_count: transitStepCount,
    transfer_count: Math.max(0, transitStepCount - 1),
    walking_distance: walkingMeters ? distanceText(walkingMeters) : "",
  };
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLegacyRoute(route = {}, origin = "", destination = "") {
  const leg = route.legs?.[0] || {};
  const steps = (leg.steps || []).map((step) => {
    const transit = step.transit_details || null;
    const line = transit?.line?.short_name || transit?.line?.name || "";
    const headsign = transit?.headsign ? ` toward ${transit.headsign}` : "";
    const instruction = transit
      ? `Take ${line || transit.line?.vehicle?.name || "transit"}${headsign} from ${transit.departure_stop?.name || "the departure stop"} to ${transit.arrival_stop?.name || "the arrival stop"}`
      : stripHtml(step.html_instructions);
    return {
      instruction,
      distance: step.distance?.text || distanceText(step.distance?.value),
      duration: step.duration?.text || durationText(`${Number(step.duration?.value || 0)}s`),
      travel_mode: step.travel_mode || "",
      transit_line: line,
      is_transit: Boolean(transit || step.travel_mode === "TRANSIT"),
    };
  }).filter((step) => step.instruction);
  const transitStepCount = steps.filter((step) => step.is_transit).length;
  const walkingMeters = (leg.steps || [])
    .filter((step) => step.travel_mode === "WALKING")
    .reduce((sum, step) => sum + Number(step.distance?.value || 0), 0);
  return {
    summary: route.summary || "Suggested public-transport route",
    distance: leg.distance?.text || "distance unavailable",
    duration: leg.duration?.text || "duration unavailable",
    start_address: leg.start_address || origin,
    end_address: leg.end_address || destination,
    departure_time: leg.departure_time?.text || "",
    arrival_time: leg.arrival_time?.text || "",
    fare: route.fare?.text || "",
    walking_distance: walkingMeters ? distanceText(walkingMeters) : "",
    transfer_count: Math.max(0, transitStepCount - 1),
    steps: steps.slice(0, 12),
    transit_step_count: transitStepCount,
  };
}

async function routeDepartureEpoch(origin = "", targetDate = "", departureTime = "") {
  if (!targetDate) return null;
  const time = /^\d{2}:\d{2}$/.test(departureTime) ? departureTime : "12:00";
  const naiveUtc = Math.floor(new Date(`${targetDate}T${time}:00Z`).getTime() / 1000);
  if (!Number.isFinite(naiveUtc)) return null;
  try {
    const location = await getLocationData(origin);
    const timezone = await googleTimeZone({ lat: location.lat, lon: location.lon, timestampSeconds: naiveUtc });
    const offset = Number(timezone?.raw_offset_seconds || 0) + Number(timezone?.dst_offset_seconds || 0);
    return naiveUtc - offset;
  } catch (error) {
    logger.debug("Route departure timezone fallback", { reason: error.message });
    return naiveUtc;
  }
}

async function legacyDirectionsRoute({ from, to, travelMode, departureEpoch, key }) {
  const params = {
    origin: from,
    destination: to,
    mode: travelMode,
    alternatives: true,
    language: "en",
    units: "metric",
    key,
  };
  if (departureEpoch && ["transit", "driving"].includes(travelMode)) params.departure_time = departureEpoch;
  const data = await withRetry(
    () => httpGet("https://maps.googleapis.com/maps/api/directions/json", params, "directions"),
    "directions",
  );
  if (data?.status !== "OK") return { routes: [], status: data?.status || "UNKNOWN_ERROR" };
  return {
    routes: (data.routes || []).slice(0, 3).map((route) => compactLegacyRoute(route, from, to)),
    status: "OK",
  };
}

async function routeTool({
  origin,
  destination,
  mode = "transit",
  departure_time = "",
  target_date = "",
  date_label = "",
}) {
  const from = String(origin || "").trim();
  const to = String(destination || "").trim();
  if (!from || !to) {
    return {
      origin: from,
      destination: to,
      routes: [],
      search_actions: [mapsSearchAction("Open route in Google Maps", `${from || "origin"} to ${to || "destination"}`, "route")],
      data_quality: dataNote("limited", "Route request needs both an origin and a destination."),
      practical_tips: ["Share both starting point and destination for a useful route."],
    };
  }

  const requestedMode = normalize(mode);
  const travelMode = ["driving", "walking", "bicycling", "transit"].includes(requestedMode) ? requestedMode : "transit";
  const displayMode = /train/.test(requestedMode) ? "train" : travelMode;
  const mapUrl = mapsDirectionsUrl(from, to, travelMode);
  const key = googlePlacesKey();
  const departureEpoch = await routeDepartureEpoch(from, target_date, departure_time);

  if (!key) {
    return {
      origin: from,
      destination: to,
      mode: displayMode,
      routes: [],
      search_actions: [{ name: "Open route in Google Maps", category: "route", address: `${from} → ${to}`, url: mapUrl, is_search: true }],
      data_quality: dataNote("limited", "ATLAS route verification is not configured, so only a map link is available."),
      practical_tips: ["Open the route in Maps and choose public transport, walking or driving depending on your situation."],
    };
  }

  try {
    const routeMode = { driving: "DRIVE", walking: "WALK", bicycling: "BICYCLE", transit: "TRANSIT" }[travelMode];
    const fieldMask = [
      "routes.description",
      "routes.distanceMeters",
      "routes.duration",
      "routes.legs.steps.distanceMeters",
      "routes.legs.steps.staticDuration",
      "routes.legs.steps.navigationInstruction.instructions",
      "routes.legs.steps.travelMode",
      "routes.legs.steps.transitDetails.headsign",
      "routes.legs.steps.transitDetails.stopCount",
      "routes.legs.steps.transitDetails.tripShortText",
      "routes.legs.steps.transitDetails.transitLine.name",
      "routes.legs.steps.transitDetails.transitLine.nameShort",
      "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name",
      "routes.legs.steps.transitDetails.stopDetails.departureStop.name",
      "routes.legs.steps.transitDetails.localizedValues.arrivalTime.time.text",
      "routes.legs.steps.transitDetails.localizedValues.departureTime.time.text",
    ].join(",");
    const routeBody = {
      origin: { address: from },
      destination: { address: to },
      travelMode: routeMode,
      computeAlternativeRoutes: routeMode !== "TRANSIT",
      languageCode: "en-US",
      units: "METRIC",
    };
    if (departureEpoch && ["TRANSIT", "DRIVE"].includes(routeMode)) {
      routeBody.departureTime = new Date(departureEpoch * 1000).toISOString();
    }
    const data = await withRetry(
      () => httpPost(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        routeBody,
        { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fieldMask },
        "directions",
      ),
      "directions"
    );

    let routes = (data.routes || []).slice(0, 3).map((route) => compactRouteLeg(route, from, to));
    let routeSource = "google_routes_api_v2";
    if (!routes.length && travelMode === "transit") {
      const legacy = await legacyDirectionsRoute({ from, to, travelMode, departureEpoch, key });
      routes = legacy.routes;
      if (routes.length) routeSource = "google_directions_api_legacy_fallback";
    }
    return {
      origin: from,
      destination: to,
      mode: displayMode,
      requested_departure: {
        date: target_date || null,
        time: departure_time || null,
        label: date_label || null,
      },
      routes,
      search_actions: [{ name: "Open route in Google Maps", category: "route", address: `${from} → ${to}`, url: mapUrl, is_search: true }],
      data_quality: dataNote(routes.length ? "verified" : "limited", routes.length ? "ATLAS verified route distance and duration. Exact live traffic and disruptions should still be checked before leaving." : "ATLAS could not verify a route for this request; use the Maps link and adjust origin, destination or mode.", { source: routeSource }),
      practical_tips: ["Check live traffic, transit disruptions and last departure times before leaving.", "For tourist trips, save the route offline or screenshot key steps."],
    };
  } catch (error) {
    if (travelMode === "transit") {
      try {
        const legacy = await legacyDirectionsRoute({ from, to, travelMode, departureEpoch, key });
        if (legacy.routes.length) {
          return {
            origin: from,
            destination: to,
            mode: displayMode,
            requested_departure: {
              date: target_date || null,
              time: departure_time || null,
              label: date_label || null,
            },
            routes: legacy.routes,
            search_actions: [{ name: "Open route in Google Maps", category: "route", address: `${from} → ${to}`, url: mapUrl, is_search: true }],
            data_quality: dataNote("verified", "ATLAS verified this transit route using the enabled Google Directions service after the primary route service returned no usable result.", { source: "google_directions_api_legacy_fallback" }),
            practical_tips: ["Check live departures, disruptions and platform information before leaving.", "For airport travel, keep extra time for immigration, baggage and finding the correct platform."],
          };
        }
      } catch (legacyError) {
        logger.debug("Legacy transit route fallback failed", { reason: legacyError.message });
      }
    }
    return {
      origin: from,
      destination: to,
      mode: displayMode,
      routes: [],
      search_actions: [{ name: "Open route in Google Maps", category: "route", address: `${from} → ${to}`, url: mapUrl, is_search: true }],
      data_quality: dataNote("limited", userSafeProviderError(error, "ATLAS could not verify this route right now.")),
      practical_tips: ["Use the Maps route link as a fallback and confirm traffic, transit schedules and walking safety before leaving."],
    };
  }
}

function sensitiveDestinationAliases(location = "", country = "") {
  const text = normalize(`${location} ${country}`);
  if (/palest|gaza|west bank/.test(text)) return ["Palestine", "Gaza", "West Bank", "Palestinian Territories"];
  if (/iran/.test(text)) return ["Iran", "Tehran"];
  if (/israel/.test(text)) return ["Israel", "Jerusalem", "Tel Aviv"];
  if (/lebanon/.test(text)) return ["Lebanon", "Beirut"];
  if (/syria/.test(text)) return ["Syria", "Damascus"];
  if (/iraq/.test(text)) return ["Iraq", "Baghdad"];
  if (/afghanistan/.test(text)) return ["Afghanistan", "Kabul"];
  if (/yemen/.test(text)) return ["Yemen", "Sanaa"];
  if (/united arab emirates|uae|abu dhabi|dubai/.test(text)) return [location, country, "United Arab Emirates", "UAE", "Abu Dhabi", "Dubai"].filter(Boolean);
  return [location, country].filter(Boolean);
}

function newsQueries(location = "", country = "", concerns = "") {
  const names = [...new Set(sensitiveDestinationAliases(location, country).filter(Boolean))];
  const subject = names.length ? names.map((name) => `"${name}"`).join(" OR ") : `"${location || country}"`;
  const safetyTerms = "travel OR tourist OR tourism OR safety OR security OR conflict OR protest OR unrest OR advisory OR border";
  return [
    `(${subject}) AND (${safetyTerms})`,
    `${names[0] || location || country} travel safety tourists ${concerns}`.trim(),
    `${names[0] || location || country} security situation travel`.trim(),
  ];
}


function keywordTokens(value = "") {
  return normalize(value)
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length >= 3);
}

function destinationKeywords(location = "", country = "") {
  const aliases = sensitiveDestinationAliases(location, country);
  const tokens = new Set();
  for (const alias of aliases) {
    for (const token of keywordTokens(alias)) tokens.add(token);
  }

  const text = normalize(`${location} ${country}`);
  if (/palest|gaza|west bank/.test(text)) {
    ["palestine", "palestinian", "gaza", "west", "bank", "israel", "israeli"].forEach((item) => tokens.add(item));
  }
  if (/iran/.test(text)) ["iran", "iranian", "tehran"].forEach((item) => tokens.add(item));
  return [...tokens];
}

function isRelevantNewsArticle(article = {}, location = "", country = "") {
  const title = article.title || "";
  const description = article.description || "";
  const content = article.content || "";
  const source = article.source?.name || "";
  const headlineHaystack = normalize(`${title} ${description}`);
  const haystack = normalize(`${title} ${description} ${content}`);
  if (!haystack) return false;

  // Avoid presenting low-trust or highly off-topic syndicated items as travel safety evidence.
  if (/\b(rt|russia today|freerepublic|free republic|slashdot)\b/i.test(source)) return false;

  const destinationText = normalize(`${location} ${country}`);
  const isPalestine = /palest|gaza|west bank/.test(destinationText);
  const isIran = /\biran\b/.test(destinationText);
  const isIsrael = /israel/.test(destinationText);

  if (isPalestine) {
    const directPalestine = /\b(palestin\w*|gaza|west bank|ramallah|bethlehem|hebron|nablus)\b/i.test(haystack);
    const relatedIsrael = /\bisrael\w*\b/i.test(haystack) && /\b(gaza|west bank|palestin\w*|checkpoint|flotilla|settler|border|hajj|detainee|aid|ceasefire)\b/i.test(haystack);
    if (!directPalestine && !relatedIsrael) return false;
  } else if (isIran) {
    if (!/\b(iran\w*|tehran)\b/i.test(haystack)) return false;
  } else if (isIsrael) {
    if (!/\b(israel\w*|jerusalem|tel aviv|gaza|west bank)\b/i.test(haystack)) return false;
  } else {
    const genericDestinationTokens = new Set(["united", "arab", "the", "and", "city", "region", "area"]);
    const aliases = sensitiveDestinationAliases(location, country);
    const hasDestination = aliases.some((alias) => {
      const key = normalize(alias);
      if (!key) return false;
      if (key.includes(" ")) return headlineHaystack.includes(key);
      if (genericDestinationTokens.has(key)) return false;
      return new RegExp(`\\b${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i").test(headlineHaystack);
    });
    if (!hasDestination) return false;
  }

  const safetyTerms = [
    "tourist", "traveller", "traveler", "travel advisory", "security", "safety", "advisory", "conflict", "war", "attack", "checkpoint", "protest", "unrest", "closure", "evacuation", "flotilla", "detainee", "detention", "ceasefire", "violence", "airport", "visa"
  ];

  // Generic destination mentions are not enough. Require a travel/safety term so the UI
  // does not show unrelated political or business headlines as tourist guidance.
  const relevanceText = isPalestine || isIran || isIsrael ? haystack : headlineHaystack;
  const hasSafetyTerm = safetyTerms.some((term) => relevanceText.includes(term));
  if (!hasSafetyTerm) return false;

  const headlineText = `${title} ${description}`;
  const strongSafety = /\b(travel advisory|security|safety|conflict|war|attack|border closure|border dispute|border clash|checkpoint|protest|unrest|closure|evacuation|detainee|detention|violence|airport closure|visa|tourist warning)\b/i.test(relevanceText);
  const directSafetyHeadline = /\b(travel advisory|tourist warning|security alert|safety warning|attack|war|armed conflict|protest|unrest|detention|violence|airport closure|border closure|evacuation)\b/i.test(headlineText);
  const directTravellerDisruption = /\b(tourist|tourists|traveller|traveler|travel advisory|tourist warning|security alert|safety warning|airport closure|flight disruption|regional flight|stranded|visa|evacuation|attack|protest|unrest|border closure)\b/i.test(headlineText);
  const healthcareOrBusinessImpactOnly = /\b(hospital|hospitals|healthcare|patients?|business(?:es)?|energy prices?|oil prices?|market uncertainty|global businesses)\b/i.test(headlineText)
    && !directTravellerDisruption;
  if (healthcareOrBusinessImpactOnly) return false;
  const sportsOrEntertainmentOnly = /\b(formula\s*1|f1|grand prix|autosport|race|racing|driver|football|cricket|tennis|match|championship|concert|film|movie|celebrity)\b/i.test(headlineText)
    && !directSafetyHeadline;
  if (sportsOrEntertainmentOnly) return false;
  const financeOrCryptoOnly = /\b(crypto|bitcoin|xrp|token|blockchain|stock|stocks|shares?|market|markets|price prediction|earnings|business|investment|funding|startup)\b/i.test(headlineText)
    && !directSafetyHeadline;
  if (financeOrCryptoOnly) return false;
  const businessOnly = /\b(fuel exports?|stockpiles?|oil|gas|market|markets|shares?|stocks?|investment|trade|tariff|earnings|business|conference|summit|bond|currency)\b/i.test(haystack)
    && !strongSafety;
  if (businessOnly) return false;
  if (/\b(fuel exports?|stockpiles?|oil|gas|market|markets|shares?|stocks?|investment|trade|tariff|earnings)\b/i.test(headlineText) && !/\b(travel advisory|security|safety|attack|war|conflict|protest|unrest|closure|detention|violence)\b/i.test(headlineText)) return false;
  if (/\b(tourism bill|tourism board|tourism promotion|tourism revenue|tourism industry)\b/i.test(headlineText) && !strongSafety) return false;

  return true;
}

const NEWS_ATTENTION_RULES = [
  { level: "high", label: "armed conflict or major security disruption in recent coverage", pattern: /\b(war|airstrike|missile|rocket|bombing|terror|terrorism|armed conflict|invasion|military operation|evacuation|airport closure|border closure)\b/i },
  { level: "high", label: "serious violence in recent coverage", pattern: /\b(attack|shooting|explosion|deadly|killed|wounded|kidnapping|hostage)\b/i },
  { level: "elevated", label: "civil disruption in recent coverage", pattern: /\b(riot|riots|unrest|clashes|curfew|state of emergency|protest|demonstration|strike|checkpoint|roadblock)\b/i },
  { level: "elevated", label: "weather or natural-hazard disruption in recent coverage", pattern: /\b(flood|landslide|earthquake|storm|wildfire|heatwave|monsoon warning|travel disruption)\b/i },
  { level: "elevated", label: "official-warning language reported in recent coverage", pattern: /\b(tourist warning|travel advisory|security alert|avoid travel|reconsider travel)\b/i },
];

function destinationBaselineCaution(location = "", country = "") {
  const text = normalize(`${location} ${country}`);
  const tiers = [
    { score: 92, label: "active war or extreme official-warning baseline", pattern: /\b(afghanistan|syria|yemen|gaza)\b/ },
    { score: 84, label: "active conflict or severe movement-risk baseline", pattern: /\b(ukraine|sudan|south sudan|somalia|haiti|myanmar)\b/ },
    { score: 78, label: "high geopolitical/security restriction baseline", pattern: /\b(iran|iraq|lebanon|north korea|libya)\b/ },
    { score: 68, label: "elevated regional-security baseline", pattern: /\b(israel|palestin|west bank|venezuela|pakistan)\b/ },
    { score: 52, label: "higher urban/security precaution baseline", pattern: /\b(brazil|rio de janeiro|mexico|kenya|south africa)\b/ },
    { score: 36, label: "moderate infrastructure, road or natural-hazard baseline", pattern: /\b(nepal|peru|india|indonesia|philippines|morocco|egypt|turkey)\b/ },
  ];
  const match = tiers.find((tier) => tier.pattern.test(text));
  return match || { score: 24, label: "ordinary destination baseline" };
}

function advisoryCaution(officialAdvisory = null) {
  const text = normalize([
    officialAdvisory?.title,
    ...(Array.isArray(officialAdvisory?.alert_status) ? officialAdvisory.alert_status : []),
  ].filter(Boolean).join(" "));
  if (!text) return { score: 0, label: "no retrieved official advisory warning" };
  if (/\b(advise against all travel|do not travel|avoid all travel)\b/i.test(text)) {
    return { score: 95, label: "official advisory includes against-all-travel language" };
  }
  if (/\b(advise against all but essential travel|avoid all but essential travel)\b/i.test(text)) {
    return { score: 82, label: "official advisory includes against-all-but-essential-travel language" };
  }
  if (/\b(terrorism|armed conflict|military|border|security|protest|unrest|kidnapping|detention|crime|state of emergency)\b/i.test(text)) {
    return { score: 58, label: "official advisory has active safety/security warnings" };
  }
  return { score: 30, label: "official advisory retrieved without strong alert language" };
}

function articleCaution(articles = [], coverage = {}) {
  const haystack = articles.map((a) => `${a.title || a.headline || ""} ${a.description || a.summary || ""}`).join(" ");
  let score = coverage.news_attention_level === "high" ? 72
    : coverage.news_attention_level === "elevated" ? 52
    : coverage.news_attention_level === "limited" ? 30
    : 12;
  const drivers = [];

  const rules = [
    { score: 86, label: "recent coverage mentions war, missiles, airstrikes or armed conflict", pattern: /\b(war|missile|airstrike|rocket|bombing|armed conflict|military operation)\b/i },
    { score: 78, label: "recent coverage mentions attacks, deaths, kidnapping or hostages", pattern: /\b(attack|shooting|explosion|deadly|killed|wounded|kidnapping|hostage)\b/i },
    { score: 62, label: "recent coverage mentions unrest, protests, checkpoints or border disruption", pattern: /\b(unrest|clashes|protest|demonstration|strike|checkpoint|roadblock|border closure|airport closure)\b/i },
    { score: 48, label: "recent coverage mentions natural hazards or travel disruption", pattern: /\b(flood|landslide|earthquake|storm|wildfire|monsoon warning|travel disruption)\b/i },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(haystack)) {
      score = Math.max(score, rule.score);
      drivers.push(rule.label);
    }
  }

  return { score, drivers };
}

function cautionLabel(score = 0) {
  if (score >= 85) return { level: "severe", label: "Red-flag / avoid or defer unless essential" };
  if (score >= 70) return { level: "high", label: "High caution" };
  if (score >= 50) return { level: "elevated", label: "Elevated caution" };
  if (score >= 30) return { level: "moderate", label: "Moderate caution" };
  return { level: "standard", label: "Standard precautions" };
}

function calculateSafetyCaution({ location = "", country = "", articles = [], officialAdvisory = null, coverage = {} } = {}) {
  const baseline = destinationBaselineCaution(location, country);
  const advisory = advisoryCaution(officialAdvisory);
  const news = articleCaution(articles, coverage);
  const strongOfficialWarning = advisory.score >= 58;
  const severeNewsSignal = news.score >= 72;
  const newsScore = baseline.score <= 40 && !strongOfficialWarning && !severeNewsSignal
    ? Math.min(news.score, 48)
    : news.score;
  const score = Math.max(baseline.score, advisory.score, newsScore);
  const label = cautionLabel(score);
  const drivers = [
    baseline.label,
    advisory.label,
    ...(coverage.main_signals || []),
    ...news.drivers,
  ].filter(Boolean);

  return {
    score,
    level: label.level,
    label: label.label,
    drivers: [...new Set(drivers)].slice(0, 5),
    interpretation: "ATLAS caution score is a planning signal from destination baseline, retrieved official advisory language and recent safety-related news. It is not an official government risk rating.",
  };
}

function newsCoverageFromArticles(articles = []) {
  const levelRank = { unavailable: 0, limited: 1, elevated: 2, high: 3 };
  let attentionLevel = articles.length ? "limited" : "unavailable";
  const signals = [];

  for (const article of articles.slice(0, 6)) {
    const haystack = `${article.title || article.headline || ""} ${article.description || article.summary || ""}`;
    const match = NEWS_ATTENTION_RULES.find((rule) => rule.pattern.test(haystack));
    if (!match) continue;
    signals.push(match.label);
    if (levelRank[match.level] > levelRank[attentionLevel]) attentionLevel = match.level;
  }

  const dates = articles
    .map((article) => Date.parse(article.publishedAt || article.published || ""))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const latestPublishedAt = dates.length ? new Date(dates[0]).toISOString() : null;
  const coverageConfidence = articles.length >= 4 ? "medium" : articles.length ? "low-medium" : "low";
  const labels = {
    high: "High-attention recent news coverage",
    elevated: "Elevated-attention recent news coverage",
    limited: "Limited relevant recent news coverage",
    unavailable: "No relevant recent news coverage retrieved",
  };

  return {
    news_attention_level: attentionLevel,
    news_attention_label: labels[attentionLevel],
    coverage_confidence: coverageConfidence,
    evidence_count: articles.length,
    latest_published_at: latestPublishedAt,
    main_signals: [...new Set(signals)].slice(0, 5),
    interpretation: "This classification describes retrieved news coverage volume/severity only. It is separate from the ATLAS caution score and is not a substitute for an official government travel advisory.",
  };
}

function officialAdvisoryLinks(location = "", country = "") {
  const countryName = countryService.canonicalCountryName(country || location);
  const alpha3 = countryService.countryAlpha3ForName(country || location).toLowerCase();
  if (!alpha3) return [];

  return [
    {
      name: `WHO health profile for ${countryName}`,
      url: `https://www.who.int/countries/${alpha3}`,
      scope: "country health profile",
    },
    {
      name: `ReliefWeb updates for ${countryName}`,
      url: `https://reliefweb.int/country/${alpha3}`,
      scope: "country-specific humanitarian and disruption updates",
    },
  ];
}

function advisoryAlertText(value) {
  const raw = typeof value === "string" ? value : value?.text || value?.title || value?.content || "";
  return String(raw).replace(/_/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

async function fetchGovUkTravelAdvisory(location = "", country = "") {
  const query = `${country || location} travel advice`.trim();
  try {
    const search = await withRetry(
      () => httpGet(
        "https://www.gov.uk/api/search.json",
        { q: query, filter_format: "travel_advice", count: 5 },
        "advisory",
      ),
      "advisory",
    );
    const results = Array.isArray(search?.results) ? search.results : [];
    const target = normalize(country || location);
    const match = results.find((item) => {
      const title = normalize(item.title || "");
      if (!target || !title) return false;
      return title.startsWith(target) || title.includes(`${target} travel advice`) || target.includes(title.replace(/\s+travel advice$/, ""));
    });
    if (!match?.link || !String(match.link).startsWith("/foreign-travel-advice/")) return null;

    const content = await withRetry(
      () => httpGet(`https://www.gov.uk/api/content${match.link}`, {}, "advisory"),
      "advisory",
    );
    const alerts = Array.isArray(content?.details?.alert_status)
      ? content.details.alert_status.map(advisoryAlertText).filter(Boolean).slice(0, 4)
      : [];
    return {
      source: "UK Foreign, Commonwealth & Development Office",
      title: content?.title || match.title,
      url: `https://www.gov.uk${match.link}`,
      updated_at: content?.public_updated_at || content?.updated_at || match.public_timestamp || null,
      reviewed_at: content?.details?.reviewed_at || null,
      alert_status: alerts,
      retrieved_at: new Date().toISOString(),
    };
  } catch (error) {
    logger.debug("Government travel advisory retrieval unavailable", { reason: error.message });
    return null;
  }
}

async function safetyTool({ location, country, specific_concerns = "general" }) {
  const checkedAt = new Date().toISOString();
  const officialAdvisory = await fetchGovUkTravelAdvisory(location, country);
  const collected = [];
  const errors = [];
  const usedQueries = [];

  const queryResults = process.env.NEWS_API_KEY ? await Promise.allSettled(
    newsQueries(location, country, specific_concerns).slice(0, 2).map(async (q) => {
      const data = await withRetry(
        () => httpGet(
          "https://newsapi.org/v2/everything",
          { q, searchIn: "title,description", sortBy: "publishedAt", pageSize: 10, language: "en", apiKey: process.env.NEWS_API_KEY },
          "news"
        ),
        "news"
      );
      return { q, articles: data.articles || [] };
    }),
  ) : [];

  if (!process.env.NEWS_API_KEY) errors.push("News API is not configured");

  for (const result of queryResults) {
    if (result.status === "rejected") {
      errors.push(result.reason?.message || "News query failed");
      continue;
    }
    usedQueries.push(result.value.q);
    collected.push(...result.value.articles.filter((a) => a.title && a.description && isRelevantNewsArticle(a, location, country)));
  }

  const seen = new Set();
  const articles = collected.filter((a) => {
    const key = `${a.title}|${a.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);

  const coverage = newsCoverageFromArticles(articles);
  const combinedConfidence = officialAdvisory && articles.length >= 3 ? "medium-high" : officialAdvisory ? "medium" : coverage.coverage_confidence;
  const caution = calculateSafetyCaution({ location, country, articles, officialAdvisory, coverage });

  return {
    location,
    country,
    current_situation: articles.map((a) => ({ headline: a.title, source: a.source?.name, published: a.publishedAt, summary: a.description, url: a.url })),
    official_advisory: officialAdvisory,
    official_advisory_links: officialAdvisoryLinks(location, country),
    safety_assessment: {
      ...coverage,
      coverage_confidence: combinedConfidence,
      caution_score: caution.score,
      caution_level: caution.level,
      caution_label: caution.label,
      caution_drivers: caution.drivers,
      caution_interpretation: caution.interpretation,
      official_advisory_status: officialAdvisory ? "retrieved" : "unavailable",
      checked_at: checkedAt,
    },
    practical_guidance: [
      "Check official travel advisories before booking or travelling.",
      "Avoid demonstrations, checkpoints, conflict areas and large crowds.",
      "Use licensed transport and keep emergency contacts, accommodation details and offline maps available.",
    ],
    data_quality: dataNote(
      officialAdvisory || articles.length ? "verified" : "limited",
      officialAdvisory
        ? "A current UK government travel-advice page was retrieved. Recent news and advisory language are used as supporting context for the ATLAS caution score."
        : "An official advisory could not be retrieved. Any recent news is incomplete context and must not be treated as a safety determination.",
      { sources: [officialAdvisory ? "govuk_fcdo" : null, articles.length ? "newsapi" : null].filter(Boolean), used_queries: usedQueries, errors: errors.slice(0, 2), irrelevant_matches_filtered: true, checked_at: checkedAt },
    ),
  };
}


function culturalTips(insightType = "culture") {
  const text = normalize(insightType);
  if (/business|meeting/.test(text)) return ["Use formal greetings at first.", "Be punctual and keep communication respectful.", "Check dress expectations before meetings."];
  if (/visa|entry|passport/.test(text)) return ["Check official entry requirements before booking.", "Confirm passport validity and visa rules.", "Keep digital and paper copies of documents."];
  if (/currency|cash|card/.test(text)) return ["Carry some local cash for smaller payments.", "Use official ATMs or exchange services.", "Inform your bank before travel if needed."];
  return ["Respect local customs and dress expectations.", "Learn basic greetings and thank-you phrases.", "Check local holidays and opening hours."];
}

async function culturalTool({ location, country, insight_type = "culture" }) {
  if (!process.env.NEWS_API_KEY) {
    return {
      location,
      country,
      insight_category: insight_type,
      practical_tips: culturalTips(insight_type),
      data_quality: dataNote("limited", "News API is not configured, so this is general cultural guidance rather than current-source context."),
    };
  }

  const q = `${country || location} ${insight_type} travel customs etiquette tourism`;
  try {
    const data = await withRetry(
      () => httpGet("https://newsapi.org/v2/everything", { q, sortBy: "relevancy", pageSize: 6, language: "en", apiKey: process.env.NEWS_API_KEY }, "news"),
      "news"
    );
    const articles = (data.articles || []).filter((a) => a.title && a.description).slice(0, 5);
    return {
      location,
      country,
      insight_category: insight_type,
      cultural_context: articles.map((a) => ({ topic: a.title, summary: a.description, source: a.source?.name, url: a.url })),
      practical_tips: culturalTips(insight_type),
      data_quality: dataNote(articles.length ? "verified" : "limited", articles.length ? "Recent public articles were returned for context. Use official sources for legal or entry-rule decisions." : "No strong recent article matches were found, so guidance should remain general.", { source: "newsapi" }),
    };
  } catch (error) {
    return {
      location,
      country,
      insight_category: insight_type,
      practical_tips: culturalTips(insight_type),
      data_quality: dataNote("limited", userSafeProviderError(error, "Current cultural or news context could not be checked right now.")),
    };
  }
}

const handlers = {
  comprehensive_weather_analysis: weatherTool,
  intelligent_restaurant_discovery: restaurantTool,
  smart_accommodation_finder: accommodationTool,
  comprehensive_safety_intelligence: safetyTool,
  cultural_and_travel_insights: culturalTool,
  local_experiences_and_attractions: attractionsTool,
  route_and_transport_planner: routeTool,
};

export const toolService = {
  getTools() {
    return tools;
  },

  async executeTool(toolName, args = {}, options = {}) {
    const handler = handlers[toolName];
    if (!handler) throw new Error(`Unknown tool: ${toolName}`);
    if (options.signal?.aborted) {
      const cancelled = new Error("Tool request cancelled");
      cancelled.code = "ERR_CANCELED";
      throw cancelled;
    }

    try {
      logger.debug(`Executing tool: ${toolName}`);
      const started = Date.now();
      const result = await toolExecutionContext.run(
        { signal: options.signal, reserveProviderCall: options.reserveProviderCall },
        () => handler(args),
      );
      const executionTime = Date.now() - started;
      logger.debug(`Tool ${toolName} completed`, { executionTime });
      return {
        ...result,
        execution_metadata: {
          tool_name: toolName,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (options.signal?.aborted || error?.code === "ERR_CANCELED") throw error;
      logger.warn(`Tool ${toolName} execution failed`, { reason: error.message });
      return {
        error: error.message,
        tool_name: toolName,
        data_quality: dataNote("unavailable", `The ${toolName.replace(/_/g, " ")} source could not be used right now. The assistant should not claim live or verified data from this source.`),
        fallback_available: true,
        timestamp: new Date().toISOString(),
      };
    }
  },

  _test: {
    yelpHeaders,
    newsCoverageFromArticles,
    calculateSafetyCaution,
    isRelevantNewsArticle,
    officialAdvisoryLinks,
    fetchGovUkTravelAdvisory,
    compactRouteLeg,
    isLowValueAttractionPlace,
    shouldRecordProviderFailure,
    assertCircuitClosed,
    recordProviderFailure,
    recordProviderSuccess,
    restaurantPlan,
    activityPlan,
  },
};

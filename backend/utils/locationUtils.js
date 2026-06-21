import axios from "axios";
import { cacheKey as buildCacheKey, getOrSetCache } from "../services/cacheService.js";
import { logger } from "./logger.js";

const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const OPEN_WEATHER_GEOCODE_URL = "https://api.openweathermap.org/geo/1.0/direct";

const locationCache = new Map();

const AMBIGUOUS_COUNTRY_OR_REGION_VALUES = new Set([
  "palestine",
  "palestinian territories",
  "west bank",
  "gaza",
  "iran",
  "iraq",
  "israel",
  "syria",
  "lebanon",
  "afghanistan",
  "yemen",
]);

const NON_LOCATION_VALUES = new Set([
  "some", "there", "here", "nearby", "same place", "same area", "same city", "be sure", "just to be sure", "sure", "ok then", "then", "weather", "forecast",
  "hourly", "hourely", "hourley", "hourly forecast", "weather forecast", "ok then check", "then check", "today", "tomorrow", "this weekend", "next week",
  "this week", "current weather", "latest forecast", "live data", "data", "play tennis", "tennis", "tennis courts", "sports center", "sports centre", "court", "courts", "know", "some hotels", "hotels there", "places there", "restaurants there", "want to know", "i want to know", "yes i want to know", "tell me more", "show me", "can you give", "give hourly"
]);

function getGoogleKey() {
  return process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
}

function getOpenWeatherKey() {
  return process.env.OPEN_WEATHER_KEY || process.env.OPENWEATHER_API_KEY || "";
}

export function normalizeLocationText(value = "") {
  return String(value || "")
    .replace(/\bhourely\b/gi, "hourly")
    .replace(/\bhourley\b/gi, "hourly")
    .normalize("NFKC")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripDiacritics(value = "") {
  return normalizeLocationText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cacheKey(location = "") {
  return stripDiacritics(location).toLowerCase();
}

function isAmbiguousCountryOrRegion(location = "") {
  const key = cacheKey(location);
  // Do not block clearly city-specific input such as "Palestine, Texas".
  if (/,/.test(String(location)) || /\b(texas|tx|usa|us|city|province|governorate)\b/i.test(String(location))) return false;
  return AMBIGUOUS_COUNTRY_OR_REGION_VALUES.has(key);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(normalizeLocationText).filter(Boolean))];
}

export function sanitizeLocationQuery(location = "") {
  let text = normalizeLocationText(location)
    .replace(/^[\s,.;:!?()\[\]{}]+|[\s,.;:!?()\[\]{}]+$/g, "");

  if (!text) return "";

  // Remove common natural-language prefixes so geocoders receive only the place name.
  // Examples: "visit hyvinkää" -> "hyvinkää", "weather in Riihimäki tomorrow" -> "Riihimäki".
  const leadingPatterns = [
    /^(?:please\s+)?(?:can|could|would)\s+you\s+(?:please\s+)?/i,
    /^(?:i|we)\s+(?:want|need|would like|am thinking|are thinking)\s+to\s+/i,
    /^(?:i|we)\s+(?:am|are)\s+(?:going|travelling|traveling|planning)\s+to\s+/i,
    /^(?:ok\s+then|okay\s+then|then)\s+/i,
    /^(?:check|get|give|show|find|look up|tell me|suggest|recommend)\s+(?:me\s+)?(?:some\s+)?(?:the\s+)?/i,
    /^(?:weather|forecast|hourly forecast|current weather|latest forecast)\s+(?:in|for|at|near|around)\s+/i,
    /^(?:hotels?|accommodations?|restaurants?|things to do|activities)\s+(?:in|near|around|at)\s+/i,
    /^(?:visit|visiting|go to|going to|travel to|traveling to|travelling to|trip to|stay in|near|around|in|at|for|to|from)\s+/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of leadingPatterns) {
      const next = text.replace(pattern, "").trim();
      if (next !== text) {
        text = next;
        changed = true;
      }
    }
  }

  // Remove trailing request words, dates, and explanations after the likely place name.
  text = text
    .replace(/\b(?:today|tomorrow|tonight|this weekend|next weekend|this week|next week|right now|currently)\b.*$/i, "")
    .replace(/\b(?:with|for|about|because|so|and|but|please|pls|just)\b.*$/i, "")
    .replace(/\b(?:weather|forecast|hourly|temperature|rain|hotels?|restaurants?|prices?)\b.*$/i, "")
    .replace(/^[\s,.;:!?()\[\]{}]+|[\s,.;:!?()\[\]{}]+$/g, "")
    .trim();

  const normalizedKey = stripDiacritics(text).toLowerCase();
  if (NON_LOCATION_VALUES.has(normalizedKey)) return "";
  const words = normalizedKey.split(/\s+/).filter(Boolean);
  const nonLocationWords = new Set(["can", "you", "give", "need", "want", "some", "there", "here", "nearby", "suggest", "recommend", "know", "weather", "forecast", "hourly", "tennis", "court", "courts", "play", "playing", "today", "tomorrow", "sure", "please", "yes", "show", "tell", "more"]);
  if (words.length && words.every((word) => nonLocationWords.has(word))) return "";
  if (text.length < 2 || text.length > 80) return "";
  if (/^\d+$/.test(text)) return "";

  return text;
}

function buildLocationVariants(location = "") {
  const raw = sanitizeLocationQuery(location);
  if (!raw) return [];

  const plain = stripDiacritics(raw);
  const variants = [raw, plain];

  const countryHint = normalizeLocationText(process.env.LOCATION_COUNTRY_HINT || "");
  if (countryHint) {
    variants.push(`${raw}, ${countryHint}`);
    if (plain !== raw) variants.push(`${plain}, ${countryHint}`);
  }

  return unique(variants);
}

function mapGoogleResult(result) {
  const { lat, lng } = result.geometry.location;
  const addressComponents = result.address_components || [];

  const component = (type) =>
    addressComponents.find((c) => c.types?.includes(type))?.long_name || "";

  const city =
    component("locality") ||
    component("postal_town") ||
    component("administrative_area_level_3") ||
    component("administrative_area_level_2") ||
    component("administrative_area_level_1") ||
    "";

  return {
    lat,
    lon: lng,
    country: component("country"),
    city,
    region: component("administrative_area_level_1"),
    formatted_address: result.formatted_address,
    place_id: result.place_id,
    source: "google_geocoding",
  };
}

function mapOpenWeatherResult(result) {
  const parts = [result.name, result.state, result.country].filter(Boolean);
  return {
    lat: result.lat,
    lon: result.lon,
    country: result.country || "",
    city: result.name || "",
    region: result.state || "",
    formatted_address: parts.join(", "),
    place_id: `${result.name || "place"}-${result.lat}-${result.lon}`,
    source: "openweather_geocoding",
  };
}

async function geocodeWithGoogle(query) {
  const key = getGoogleKey();
  if (!key) return null;

  const cacheKey = buildCacheKey("geocode:google", { query });
  const { value } = await getOrSetCache(cacheKey, Number(process.env.CACHE_GEOCODE_TTL_SECONDS || 7 * 24 * 60 * 60), async () => {
    const res = await axios.get(GOOGLE_GEOCODE_URL, {
      params: { address: query, key },
      timeout: 10000,
    });

    if (res.data.status !== "OK" || !res.data.results?.length) return null;

    const result =
      res.data.results.find((item) =>
        item.types?.some((type) =>
          ["locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2"].includes(type)
        )
      ) || res.data.results[0];

    return mapGoogleResult(result);
  });

  return value;
}

async function geocodeWithOpenWeather(query) {
  const key = getOpenWeatherKey();
  if (!key) return null;

  const cacheKey = buildCacheKey("geocode:openweather", { query });
  const { value } = await getOrSetCache(cacheKey, Number(process.env.CACHE_GEOCODE_TTL_SECONDS || 7 * 24 * 60 * 60), async () => {
    const res = await axios.get(OPEN_WEATHER_GEOCODE_URL, {
      params: { q: query, limit: 5, appid: key },
      timeout: 10000,
    });

    if (!Array.isArray(res.data) || !res.data.length) return null;
    return mapOpenWeatherResult(res.data[0]);
  });

  return value;
}

export async function getLocationData(location) {
  const cleaned = sanitizeLocationQuery(location);
  if (!cleaned) throw new Error(`Location is required. Received: "${normalizeLocationText(location)}"`);

  if (isAmbiguousCountryOrRegion(cleaned)) {
    throw new Error(`"${cleaned}" is a country/region-level destination, not a city. Use country-level safety/culture tools or ask the user for a specific city before requesting weather or local venues.`);
  }

  const key = cacheKey(cleaned);
  if (locationCache.has(key)) return locationCache.get(key);

  const variants = buildLocationVariants(cleaned);
  const errors = [];

  for (const query of variants) {
    try {
      const result = await geocodeWithGoogle(query);
      if (Number.isFinite(Number(result?.lat)) && Number.isFinite(Number(result?.lon))) {
        locationCache.set(key, result);
        return result;
      }
    } catch (error) {
      errors.push(`Google: ${error.message}`);
    }
  }

  for (const query of variants) {
    try {
      const result = await geocodeWithOpenWeather(query);
      if (Number.isFinite(Number(result?.lat)) && Number.isFinite(Number(result?.lon))) {
        locationCache.set(key, result);
        return result;
      }
    } catch (error) {
      errors.push(`OpenWeather: ${error.message}`);
    }
  }

  const configured = [];
  if (getGoogleKey()) configured.push("Google Geocoding");
  if (getOpenWeatherKey()) configured.push("OpenWeather Geocoding");

  const configMessage = configured.length
    ? `Configured geocoders tried: ${configured.join(", ")}.`
    : "No geocoding API key is configured. Set GOOGLE_MAPS_API_KEY or OPEN_WEATHER_KEY.";

  logger.warn(`Location data error: Location not found. ${configMessage}`);
  if (errors.length) logger.debug("Location resolver details", { errors: errors.slice(0, 3).join(" | ") });

  throw new Error(`Location not found for "${cleaned}". ${configMessage}`);
}

export function validateCoordinates(lat, lon) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new Error("Invalid coordinates: must be numbers");
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error("Invalid latitude: must be between -90 and 90");
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error("Invalid longitude: must be between -180 and 180");
  }

  return { latitude, longitude };
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

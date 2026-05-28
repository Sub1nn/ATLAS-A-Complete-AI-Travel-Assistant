import axios from "axios";

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
];

const TIMEOUTS = {
  weather: 10000,
  google_places: 9000,
  news: 12000,
  default: 10000,
};

const RETRIES = {
  maxRetries: 2,
  baseDelay: 700,
};

function googlePlacesKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function openWeatherKey() {
  return process.env.OPEN_WEATHER_KEY || process.env.OPENWEATHER_API_KEY || "";
}

function yelpKey() {
  return process.env.YELP_API_KEY || "";
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
    .replace(/\b[\p{L}]/gu, (c) => c.toUpperCase());
}

function toNumber(value, name) {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) throw new Error(`${name} must be a valid number`);
  return n;
}

async function httpGet(url, params = {}, service = "default") {
  const response = await axios.get(url, {
    params,
    timeout: TIMEOUTS[service] || TIMEOUTS.default,
    validateStatus: (status) => status < 500,
  });

  if (response.status >= 400) {
    throw new Error(`${service} returned HTTP ${response.status}`);
  }

  return response.data;
}

async function withRetry(fn, service = "default") {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES.maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = String(error.message || "");
      if (/401|403|INVALID_REQUEST|REQUEST_DENIED/i.test(message)) break;
      if (attempt < RETRIES.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, RETRIES.baseDelay * attempt));
      }
    }
  }
  throw lastError;
}

function compactPlace(place = {}, locationName = "") {
  return {
    name: place.name || "Unknown place",
    rating: place.rating || null,
    review_count: place.user_ratings_total || 0,
    price_level: typeof place.price_level === "number" ? place.price_level : null,
    price_hint: typeof place.price_level === "number" ? "$".repeat(Math.max(1, place.price_level)) : "varies",
    address: place.vicinity || place.formatted_address || "",
    types: (place.types || []).filter((type) => !["establishment", "point_of_interest"].includes(type)),
    open_now: typeof place.opening_hours?.open_now === "boolean" ? place.opening_hours.open_now : null,
    place_id: place.place_id || null,
    source: "google_places",
    verified_from_google: true,
    verified_from_yelp: false,
    location_context: locationName,
  };
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

function dedupePlaces(places = []) {
  const seen = new Set();
  const out = [];
  for (const place of places) {
    const key = place.place_id || place.id || normalize(`${place.name} ${place.vicinity || place.formatted_address || place.location?.address1 || ""}`);
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
      const reviews = Math.min(Number(place.user_ratings_total || place.review_count || 0), 1000) / 250;
      const openBonus = place.opening_hours?.open_now ? 0.4 : 0;
      return rating + reviews + openBonus;
    };
    return score(b) - score(a);
  });
}

async function nearbySearch({ lat, lon, radius = 5000, type, keyword }) {
  const key = googlePlacesKey();
  if (!key) throw new Error("Google Places API key is not configured");

  const data = await httpGet(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    {
      location: `${lat},${lon}`,
      radius,
      type,
      keyword,
      key,
    },
    "google_places"
  );

  if (["OK", "ZERO_RESULTS"].includes(data.status)) return data.results || [];
  throw new Error(`Google Places ${data.status}${data.error_message ? `: ${data.error_message}` : ""}`);
}

async function textSearch({ query, lat, lon, radius = 8000 }) {
  const key = googlePlacesKey();
  if (!key) throw new Error("Google Places API key is not configured");

  const data = await httpGet(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    {
      query,
      location: `${lat},${lon}`,
      radius,
      key,
    },
    "google_places"
  );

  if (["OK", "ZERO_RESULTS"].includes(data.status)) return data.results || [];
  throw new Error(`Google Places ${data.status}${data.error_message ? `: ${data.error_message}` : ""}`);
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
    "google_places"
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

async function runPlaceSearchPlan(plan = [], lat, lon, locationName, maxCalls = 7) {
  const all = [];
  const errors = [];
  const used = [];

  for (const step of plan.slice(0, maxCalls)) {
    try {
      const results = await withRetry(async () => {
        if (step.mode === "yelp") {
          return yelpSearch({ term: step.term || step.query, lat, lon, categories: step.categories || "", radius: step.radius || 12000, limit: step.limit || 8 });
        }
        if (step.mode === "text") {
          return textSearch({ query: step.query, lat, lon, radius: step.radius || 9000 });
        }
        return nearbySearch({ lat, lon, radius: step.radius || 7000, type: step.type, keyword: step.keyword });
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

  return {
    raw: rankPlaces(dedupePlaces(all)),
    used_queries: used,
    errors,
    locationName,
  };
}

function activityPlan(interestType = "attractions", locationName = "") {
  const text = normalize(interestType);
  const plan = [];

  const add = (step) => plan.push(step);

  if (/tennis|court|courts|sports|sport|play tennis/.test(text)) {
    add({ mode: "text", query: `tennis court near ${locationName}` });
    add({ mode: "text", query: `public tennis courts in ${locationName}` });
    add({ mode: "text", query: `free tennis courts in ${locationName}` });
    add({ mode: "text", query: `municipal tennis courts in ${locationName}` });
    add({ mode: "text", query: `tennis courts in ${locationName}` });
    add({ mode: "text", query: `tennis club in ${locationName}` });
    add({ mode: "text", query: `outdoor tennis courts in ${locationName}` });
    add({ mode: "text", query: `indoor tennis courts in ${locationName}` });
    add({ mode: "text", query: `sports center tennis in ${locationName}` });
    add({ mode: "text", query: `sports centre tennis in ${locationName}` });
    add({ mode: "nearby", type: "park", keyword: "tennis court" });
    add({ mode: "nearby", type: "gym", keyword: "tennis" });
    add({ mode: "nearby", type: "point_of_interest", keyword: "tennis" });
    add({ mode: "yelp", term: `tennis courts ${locationName}`, categories: "tennis,sports_clubs,active" });
    add({ mode: "yelp", term: `sports centers ${locationName}`, categories: "active" });
    return plan;
  }

  if (/baby|family|child|kid|indoor|rain|stroller/.test(text)) {
    add({ mode: "text", query: `indoor playground in ${locationName}` });
    add({ mode: "nearby", type: "museum" });
    add({ mode: "nearby", type: "library" });
    add({ mode: "nearby", type: "shopping_mall" });
    add({ mode: "nearby", type: "cafe", keyword: "family" });
    add({ mode: "nearby", type: "restaurant", keyword: "family friendly" });
    add({ mode: "nearby", type: "park" });
    add({ mode: "text", query: `family activities in ${locationName}` });
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
  const keyword = text.includes("local") || text.includes("traditional") ? "traditional local" : cuisine;
  plan.push({ mode: "text", query: `${keyword} restaurants in ${locationName}` });
  plan.push({ mode: "nearby", type: "restaurant", keyword });
  plan.push({ mode: "nearby", type: "restaurant" });
  plan.push({ mode: "nearby", type: "cafe" });
  if (/street|cheap|budget|local/.test(text)) plan.push({ mode: "text", query: `cheap local food in ${locationName}` });
  if (/family|baby|child|kid/.test(text)) plan.push({ mode: "text", query: `family friendly restaurants in ${locationName}` });
  plan.push({ mode: "yelp", term: `${keyword} restaurants ${locationName}`, categories: "restaurants,cafes" });
  return plan;
}

function accommodationPlan(budget = "budget", stayType = "hotel", locationName = "") {
  const text = normalize(`${budget} ${stayType}`);
  const plan = [];

  if (/cheap|budget|hostel|guesthouse|guest house|homestay|backpacker|\$/.test(text)) {
    plan.push({ mode: "text", query: `hostels in ${locationName}` });
    plan.push({ mode: "text", query: `guesthouses in ${locationName}` });
    plan.push({ mode: "text", query: `budget hotels in ${locationName}` });
    plan.push({ mode: "nearby", type: "lodging", keyword: "hostel guesthouse budget" });
  } else if (/luxury|premium|resort|5 star|five star/.test(text)) {
    plan.push({ mode: "text", query: `luxury hotels in ${locationName}` });
    plan.push({ mode: "nearby", type: "lodging", keyword: "luxury hotel" });
  } else {
    plan.push({ mode: "text", query: `${stayType || "hotel"} in ${locationName}` });
    plan.push({ mode: "nearby", type: "lodging" });
  }

  plan.push({ mode: "nearby", type: "lodging" });
  return plan;
}

function highEndHotelName(name = "") {
  return /\b(radisson|marriott|hyatt|hilton|sheraton|intercontinental|crowne|autograph|soaltee|shanker|palace|resort|luxury|ritz|four seasons|mandarin oriental)\b/i.test(String(name));
}

function budgetAccommodationScore(place = {}) {
  const name = String(place.name || "");
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
      .filter((place) => !highEndHotelName(place.name))
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
    mapsSearchAction(`${titleCase(term)} search`, `${term} in ${locationName}`, "search")
  );

  return {
    location: locationName,
    recommendations: [],
    search_actions: searchActions,
    data_quality: dataNote(
      "limited",
      `Live venue search did not return verified ${category} matches for this exact request. Do not present specific venue names as verified live results unless they appear in another reliable source.`,
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

async function weatherTool({ latitude, longitude, location_name }) {
  const lat = toNumber(latitude, "latitude");
  const lon = toNumber(longitude, "longitude");
  const key = openWeatherKey();
  if (!key) throw new Error("OpenWeather API key is not configured");

  const [current, forecast] = await Promise.all([
    withRetry(() => httpGet("https://api.openweathermap.org/data/2.5/weather", { lat, lon, appid: key, units: "metric" }, "weather"), "weather"),
    withRetry(() => httpGet("https://api.openweathermap.org/data/2.5/forecast", { lat, lon, appid: key, units: "metric" }, "weather"), "weather"),
  ]);

  if (!current?.main || !current?.weather?.length) throw new Error("Weather API returned incomplete current conditions");

  const condition = current.weather[0].main;
  const temp = current.main.temp;

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
    hourly_forecast: (forecast.list || []).slice(0, 8).map((item) => ({
      time: new Date(item.dt * 1000).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", weekday: "short", day: "2-digit", month: "short" }),
      temperature: Math.round(item.main.temp),
      description: item.weather?.[0]?.description || "forecast unavailable",
      rain_probability: Math.round((item.pop || 0) * 100),
      wind_speed: Math.round((item.wind?.speed || 0) * 3.6),
    })),
    travel_recommendations: {
      best_approach: getWeatherAdvice(temp, condition),
      clothing: getClothingAdvice(temp, condition),
      alerts: weatherAlerts(current, forecast),
    },
    data_quality: dataNote("verified", "Current weather and forecast data were returned by OpenWeather for the resolved coordinates. Wind values are converted from m/s to km/h.", { source: "openweather", updated_at: new Date().toISOString() }),
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
      search_metadata: { used_queries, errors: errors.slice(0, 3), source: "google_places_api" },
    };
  }

  let restaurants = raw;
  const budget = normalize(budget_level);
  if (/budget|cheap/.test(budget)) restaurants = restaurants.filter((r) => !r.price_level || r.price_level <= 2);
  if (/premium|luxury/.test(budget)) restaurants = restaurants.filter((r) => !r.price_level || r.price_level >= 2);
  restaurants = rankPlaces(restaurants).slice(0, 8);

  return {
    location: location_name,
    cuisine_focus: cuisine_preference,
    restaurants: restaurants.map((place) => place.id && !place.place_id ? compactYelpPlace(place, location_name) : compactPlace(place, location_name)),
    dining_tips: "Use this as a verified discovery shortlist from Google Places. Confirm opening hours, current menu and reservation needs before going.",
    data_quality: dataNote("verified", "Restaurant results were returned by Google Places. Ratings and opening status can change, so verify before visiting.", { source: yelpKey() ? "google_places_api_and_yelp_api" : "google_places_api" }),
    search_metadata: { total_found: restaurants.length, used_queries, source: yelpKey() ? "google_places_api_and_yelp_api" : "google_places_api" },
  };
}

async function accommodationTool({ lat, lon, location_name, budget_category = "budget", stay_type = "hotel" }) {
  const latitude = toNumber(lat, "lat");
  const longitude = toNumber(lon, "lon");
  const plan = accommodationPlan(budget_category, stay_type, location_name);
  const { raw, used_queries, errors } = await runPlaceSearchPlan(plan, latitude, longitude, location_name, 6);

  if (!raw.length) {
    return {
      location: location_name,
      accommodation_type: stay_type,
      properties: [],
      data_quality: dataNote(
        "limited",
        "Google Places did not return verified accommodation matches for this exact request. Do not present hotel names as verified live options.",
        { fallback_suggestions: ["hostels", "guesthouses", "homestays", "simple hotels", "apartments with recent reviews"] }
      ),
      booking_insights: "Confirm final nightly prices, taxes, cancellation policy and recent reviews on booking platforms for your exact dates.",
      search_metadata: { used_queries, errors: errors.slice(0, 3), source: "google_places_api" },
    };
  }

  const ranked = filterAndRankAccommodation(raw, budget_category);
  return {
    location: location_name,
    accommodation_type: stay_type,
    budget_range: budget_category,
    properties: ranked.map((place) => compactPlace(place, location_name)),
    booking_insights: "Google Places does not provide guaranteed live booking prices. Use these verified property names as a discovery shortlist, then confirm exact nightly rates and taxes on booking platforms or property websites.",
    data_quality: dataNote("verified", "Accommodation names and ratings were returned by Google Places; live room prices and availability were not returned.", { source: "google_places_api", live_prices_available: false }),
    search_metadata: { total_found: ranked.length, used_queries, source: "google_places_api" },
  };
}

async function attractionsTool({ lat, lon, location_name, interest_type = "attractions" }) {
  const latitude = toNumber(lat, "lat");
  const longitude = toNumber(lon, "lon");
  const plan = activityPlan(interest_type, location_name);
  const { raw, used_queries, errors } = await runPlaceSearchPlan(plan, latitude, longitude, location_name, 9);

  if (!raw.length) {
    return {
      ...noPlacesResult(location_name, "activity or attraction", ["museums", "libraries", "shopping centres", "parks", "cafes", "official tourism pages"]),
      experience_category: interest_type,
      search_metadata: { used_queries, errors: errors.slice(0, 3), source: "google_places_api" },
    };
  }

  const recommendations = rankPlaces(raw).slice(0, 10).map((place) => ({
    ...(place.id && !place.place_id ? compactYelpPlace(place, location_name) : compactPlace(place, location_name)),
    category: (place.types || []).filter((type) => !["establishment", "point_of_interest"].includes(type)).join(", ") || interest_type,
    why_visit: place.rating >= 4 ? "Highly rated by Google users" : "Relevant local option returned by Google Places",
  }));

  return {
    location: location_name,
    experience_category: interest_type,
    recommendations,
    planning_tips: /tennis|court|sports/.test(normalize(interest_type))
      ? "Use this as a verified discovery shortlist from Google Places. Google Places usually cannot confirm whether a court is free, so check the municipality, club website or venue phone number before going."
      : "Use this as a verified discovery shortlist. Check opening hours, stroller access, booking rules and recent reviews before visiting.",
    data_quality: dataNote("verified", /tennis|court|sports/.test(normalize(interest_type))
      ? "Venue results were returned by Google Places. Free/public access cannot be guaranteed from Places data alone."
      : "Activity and venue results were returned by Google Places. Suitability details such as baby facilities or accessibility should still be checked directly.", { source: yelpKey() ? "google_places_api_and_yelp_api" : "google_places_api" }),
    search_metadata: { total_found: recommendations.length, used_queries, source: yelpKey() ? "google_places_api_and_yelp_api" : "google_places_api" },
  };
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
    const destTokens = destinationKeywords(location, country);
    const hasDestination = destTokens.some((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i").test(haystack));
    if (!hasDestination) return false;
  }

  const safetyTerms = [
    "tourist", "tourism", "traveller", "traveler", "travel advisory", "security", "safety", "advisory", "conflict", "war", "attack", "border", "checkpoint", "protest", "unrest", "closure", "evacuation", "flotilla", "hajj", "detainee", "ceasefire", "violence", "airport", "visa"
  ];

  // Generic destination mentions are not enough. Require a travel/safety term so the UI
  // does not show unrelated political or business headlines as tourist guidance.
  return safetyTerms.some((term) => haystack.includes(term));
}

function safetyRiskLevel(location = "", country = "", articleCount = 0) {
  const text = normalize(`${location} ${country}`);
  if (/gaza|west bank|palest|syria|yemen|afghanistan/.test(text)) return "high attention / check official advisories";
  if (/iran|iraq|israel|lebanon/.test(text)) return "elevated / check official advisories";
  return articleCount ? "review current advisories" : "standard precautions, unverified current news";
}

function officialAdvisoryLinks(location = "", country = "") {
  const parts = [location, country].filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const part of parts) {
    const key = normalize(part);
    if (key && !seen.has(key)) {
      unique.push(part);
      seen.add(key);
    }
  }
  const label = encodeURIComponent(unique.join(" ") || location || country || "travel");
  return [
    { name: "Finland MFA travel advisories", url: "https://um.fi/matkustustiedotteet-a-o" },
    { name: "UK FCDO travel advice", url: `https://www.gov.uk/foreign-travel-advice/search?q=${label}` },
    { name: "US State Department travel advisories", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" },
  ];
}

async function safetyTool({ location, country, specific_concerns = "general" }) {
  if (!process.env.NEWS_API_KEY) {
    return {
      location,
      country,
      official_advisory_links: officialAdvisoryLinks(location, country),
      data_quality: dataNote("limited", "News API is not configured, so current news-based safety monitoring is unavailable."),
      safety_assessment: { overall_risk_level: "unverified", confidence_level: "low" },
      practical_guidance: [
        "Check your government's official travel advisory before making final decisions.",
        "Use normal urban precautions around valuables, transport and unfamiliar areas.",
        "Keep emergency contacts and your accommodation address offline.",
      ],
    };
  }

  const collected = [];
  const errors = [];
  const usedQueries = [];

  for (const q of newsQueries(location, country, specific_concerns)) {
    try {
      const data = await withRetry(
        () => httpGet(
          "https://newsapi.org/v2/everything",
          { q, searchIn: "title,description", sortBy: "publishedAt", pageSize: 10, language: "en", apiKey: process.env.NEWS_API_KEY },
          "news"
        ),
        "news"
      );
      usedQueries.push(q);
      const relevant = (data.articles || []).filter((a) => a.title && a.description && isRelevantNewsArticle(a, location, country));
      collected.push(...relevant);
      if (collected.length >= 5) break;
    } catch (error) {
      errors.push(error.message);
    }
  }

  const seen = new Set();
  const articles = collected.filter((a) => {
    const key = `${a.title}|${a.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);

  return {
    location,
    country,
    current_situation: articles.map((a) => ({ headline: a.title, source: a.source?.name, published: a.publishedAt, summary: a.description, url: a.url })),
    official_advisory_links: officialAdvisoryLinks(location, country),
    safety_assessment: {
      overall_risk_level: safetyRiskLevel(location, country, articles.length),
      confidence_level: articles.length >= 3 ? "medium" : "low",
    },
    practical_guidance: [
      "Check official travel advisories before booking or travelling.",
      "Avoid demonstrations, checkpoints, conflict areas and large crowds.",
      "Use licensed transport and keep emergency contacts, accommodation details and offline maps available.",
    ],
    data_quality: dataNote(articles.length ? "verified" : "limited", articles.length ? "Relevant recent news articles were returned by News API after destination filtering. Official advisories remain the primary source for safety decisions." : "News API was checked and irrelevant matches were filtered out, but no targeted recent matches were returned for this exact destination. Do not interpret this as proof that travel is safe.", { source: "newsapi", used_queries: usedQueries, errors: errors.slice(0, 2), irrelevant_matches_filtered: true }),
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
      data_quality: dataNote("limited", `Current cultural/news context could not be checked: ${error.message}`),
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
};

export const toolService = {
  getTools() {
    return tools;
  },

  async executeTool(toolName, args = {}) {
    const handler = handlers[toolName];
    if (!handler) throw new Error(`Unknown tool: ${toolName}`);

    try {
      console.log(`🔧 Executing tool: ${toolName} with args:`, JSON.stringify(args, null, 2));
      const started = Date.now();
      const result = await handler(args);
      const executionTime = Date.now() - started;
      console.log(`✅ Tool ${toolName} completed successfully in ${executionTime}ms`);
      return {
        ...result,
        execution_metadata: {
          tool_name: toolName,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error(`❌ Tool ${toolName} execution failed:`, error.message);
      return {
        error: error.message,
        tool_name: toolName,
        data_quality: dataNote("unavailable", `The ${toolName.replace(/_/g, " ")} source could not be used right now. The assistant should not claim live or verified data from this source.`),
        fallback_available: true,
        timestamp: new Date().toISOString(),
      };
    }
  },
};

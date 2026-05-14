import axios from "axios";

const tools = [
  {
    type: "function",
    function: {
      name: "comprehensive_weather_analysis",
      description:
        "Get detailed weather analysis including current conditions, forecast, and travel recommendations",
      parameters: {
        type: "object",
        properties: {
          latitude: {
            type: ["number", "string"], // FIXED: Accept both number and string
            description: "Latitude coordinate (-90 to 90)",
          },
          longitude: {
            type: ["number", "string"], // FIXED: Accept both number and string
            description: "Longitude coordinate (-180 to 180)",
          },
          location_name: {
            type: "string",
            description: "Name of the location for weather analysis",
          },
        },
        required: ["latitude", "longitude", "location_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "intelligent_restaurant_discovery",
      description:
        "Discover restaurants with detailed analysis using Google Places API",
      parameters: {
        type: "object",
        properties: {
          lat: {
            type: ["number", "string"], // FIXED: Accept both number and string
            description: "Latitude coordinate",
          },
          lon: {
            type: ["number", "string"], // FIXED: Accept both number and string
            description: "Longitude coordinate",
          },
          location_name: {
            type: "string",
            description: "Name of the location",
          },
          cuisine_preference: {
            type: "string",
            description: "Cuisine preference or 'local traditional'",
          },
          budget_level: {
            type: "string",
            description: "Budget level preference",
          },
        },
        required: ["lat", "lon", "location_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "smart_accommodation_finder",
      description: "Find hotels and accommodations using Google Places API",
      parameters: {
        type: "object",
        properties: {
          lat: {
            type: ["number", "string"], // FIXED: Accept both number and string
            description: "Latitude coordinate",
          },
          lon: {
            type: ["number", "string"], // FIXED: Accept both number and string
            description: "Longitude coordinate",
          },
          location_name: {
            type: "string",
            description: "Name of the location",
          },
          budget_category: {
            type: "string",
            description: "Budget category",
          },
          stay_type: {
            type: "string",
            description: "Type of accommodation",
          },
        },
        required: ["lat", "lon", "location_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "comprehensive_safety_intelligence",
      description: "Analyze safety and security for travel destinations",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City or region name",
          },
          country: {
            type: "string",
            description: "Country name",
          },
          specific_concerns: {
            type: "string",
            description: "Specific safety concerns to focus on",
          },
        },
        required: ["location", "country"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cultural_and_travel_insights",
      description: "Get cultural context and travel information",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City or region name",
          },
          country: {
            type: "string",
            description: "Country name",
          },
          insight_type: {
            type: "string",
            description: "Type of cultural insights needed",
          },
        },
        required: ["location", "country"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "local_experiences_and_attractions",
      description:
        "Discover attractions and experiences using Google Places API",
      parameters: {
        type: "object",
        properties: {
          lat: {
            type: ["number", "string"], // FIXED: Accept both number and string
            description: "Latitude coordinate",
          },
          lon: {
            type: ["number", "string"], // FIXED: Accept both number and string
            description: "Longitude coordinate",
          },
          location_name: {
            type: "string",
            description: "Name of the location",
          },
          interest_type: {
            type: "string",
            description: "Type of interests or attractions",
          },
        },
        required: ["lat", "lon", "location_name"],
      },
    },
  },
];

// Enhanced timeout configuration for different services
const API_TIMEOUTS = {
  weather: 10000, // 10 seconds
  google_places: 8000, // 8 seconds
  news: 20000, // 20 seconds
  google: 8000, // 8 seconds
  default: 12000, // 12 seconds
};

// Enhanced retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 8000, // 8 seconds
  backoffFactor: 2,
};

// Helper class for API request management
class APIRequestManager {
  static async makeRequest(url, options = {}, serviceName = "default") {
    const timeout = API_TIMEOUTS[serviceName] || API_TIMEOUTS.default;

    const config = {
      timeout,
      validateStatus: (status) => status < 500, // Don't throw for 4xx errors
      ...options,
    };

    try {
      const response = await axios(url, config);

      if (response.status >= 400) {
        throw new Error(
          `API returned ${response.status}: ${response.statusText}`
        );
      }

      return response;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  static async retryRequest(requestFn, serviceName = "default") {
    let lastError;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // Don't retry for certain error types
        if (error.message.includes("401") || error.message.includes("403")) {
          throw error;
        }

        if (attempt < RETRY_CONFIG.maxRetries) {
          const delay = Math.min(
            RETRY_CONFIG.baseDelay *
              Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1),
            RETRY_CONFIG.maxDelay
          );

          console.log(
            `🔄 Retrying ${serviceName} request (attempt ${attempt + 1}/${
              RETRY_CONFIG.maxRetries
            }) after ${delay}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

// Helper functions for safety intelligence
const assessSourceReliability = (sourceName) => {
  const reliableSources = [
    "Reuters",
    "Associated Press",
    "BBC",
    "CNN",
    "Al Jazeera",
    "The Guardian",
    "Wall Street Journal",
    "Financial Times",
    "NPR",
    "NBC News",
    "CBS News",
    "ABC News",
    "The New York Times",
    "The Washington Post",
    "Bloomberg",
    "The Economist",
    "Foreign Affairs",
    "Foreign Policy",
  ];

  return reliableSources.some((source) =>
    sourceName.toLowerCase().includes(source.toLowerCase())
  )
    ? "HIGH"
    : "MEDIUM";
};

const getRecencyDescription = (dateString) => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);

    if (diffHours < 24) return "LAST 24 HOURS";
    if (diffHours < 168) return "THIS WEEK";
    if (diffHours < 720) return "THIS MONTH";
    return "RECENT";
  } catch (error) {
    return "UNKNOWN";
  }
};

const identifyTrendingRisks = (riskFactors) => {
  try {
    const categoryGroups = {};
    riskFactors.forEach((factor) => {
      if (!categoryGroups[factor.category]) {
        categoryGroups[factor.category] = [];
      }
      categoryGroups[factor.category].push(factor);
    });

    return Object.entries(categoryGroups)
      .filter(([_, factors]) => factors.length > 1)
      .map(([category, factors]) => ({
        risk_category: category.replace("_", " ").toUpperCase(),
        frequency: factors.length,
        trend: factors.length > 3 ? "INCREASING" : "STABLE",
      }));
  } catch (error) {
    console.error("Error identifying trending risks:", error.message);
    return [];
  }
};

const calculateRelevanceScore = (article, location, country) => {
  try {
    let score = 0;
    const text = (
      article.title +
      " " +
      (article.description || "")
    ).toLowerCase();
    const locationLower = location.toLowerCase();
    const countryLower = country.toLowerCase();

    if (text.includes(locationLower)) score += 3;
    if (text.includes(countryLower)) score += 2;
    if (text.includes("travel") || text.includes("tourist")) score += 1;

    return Math.min(5, score);
  } catch (error) {
    return 0;
  }
};

const generateSecurityRecommendations = (
  riskLevel,
  location,
  country,
  concerns
) => {
  const baseRecommendations = {
    pre_travel: [
      "Register with embassy/consulate travel programs",
      "Obtain comprehensive travel insurance with security coverage",
      "Research local laws and cultural sensitivities",
      "Prepare emergency contact information and communication plans",
      "Share detailed itinerary with trusted contacts",
    ],
    during_travel: [
      "Maintain low profile and avoid displaying wealth",
      "Stay informed about local developments and news",
      "Avoid large gatherings and demonstrations",
      "Keep emergency cash and documents in secure locations",
      "Use hotel safes for valuables and important documents",
    ],
    communication: [
      "Establish regular check-in schedules with family/colleagues",
      "Use secure communication methods when possible",
      "Keep local emergency numbers readily accessible",
      "Maintain backup communication devices if necessary",
      "Download offline maps and translation apps",
    ],
  };

  if (riskLevel.includes("HIGH") || riskLevel.includes("CRITICAL")) {
    baseRecommendations.pre_travel.push(
      "Consider professional security consultation",
      "Develop detailed evacuation contingency plans",
      "Coordinate with security professionals in destination",
      "Consider postponing non-essential travel"
    );
    baseRecommendations.during_travel.push(
      "Consider hiring local security escort for movements",
      "Avoid routine patterns and vary routes/timing",
      "Stay in security-conscious accommodations",
      "Register location with embassy regularly"
    );
  }

  return baseRecommendations;
};

const getOfficialAdvisorySource = () => {
  return "your government's official travel advisory service (e.g., US State Department, UK FCO, etc.)";
};

// Weather helper functions
function getWeatherAdvice(temp, condition) {
  if (temp > 25 && condition === "Clear")
    return "Excellent weather for travel and outdoor activities";
  if (temp < 5) return "Cold weather - dress warmly and plan indoor activities";
  if (condition === "Rain")
    return "Rainy conditions - carry umbrella and plan covered activities";
  if (temp > 15 && temp < 30) return "Pleasant weather conditions for travel";
  return "Check current conditions before outdoor activities";
}

function getClothingAdvice(temp, condition) {
  const advice = [];

  if (temp < 0) advice.push("Heavy winter clothing, thermal layers");
  else if (temp < 10) advice.push("Warm clothing, jacket required");
  else if (temp < 20) advice.push("Light jacket or sweater recommended");
  else if (temp < 30) advice.push("Comfortable casual clothing");
  else advice.push("Light, breathable clothing, sun protection");

  if (condition === "Rain") advice.push("Waterproof jacket and footwear");
  if (condition === "Snow")
    advice.push("Waterproof boots and winter accessories");

  return advice.join(", ");
}

function getActivityAdvice(condition, windSpeed) {
  if (condition === "Clear" && windSpeed < 10)
    return "Perfect conditions for all outdoor activities";
  if (condition === "Rain")
    return "Indoor activities recommended, museums, shopping centers";
  if (windSpeed > 15)
    return "Windy conditions - be cautious with outdoor activities";
  if (condition === "Snow")
    return "Winter activities possible, check local conditions";
  return "Generally good conditions for outdoor activities with normal precautions";
}

function getWeatherAlerts(current, forecast) {
  const alerts = [];

  if (current.main.temp > 35) alerts.push("Heat warning - stay hydrated");
  if (current.main.temp < -10)
    alerts.push("Extreme cold - limit outdoor exposure");
  if (current.wind?.speed > 20) alerts.push("High wind conditions");

  const severeWeather = forecast.list
    .slice(0, 3)
    .some(
      (item) =>
        item.weather[0].main === "Thunderstorm" ||
        item.weather[0].main === "Snow" ||
        item.main.temp > 35 ||
        item.main.temp < -15
    );

  if (severeWeather) alerts.push("Severe weather expected in next 24 hours");

  return alerts.length > 0 ? alerts : ["No current weather alerts"];
}

// Google Places helper functions
function mapGooglePlacesToRestaurant(place, location_name) {
  return {
    name: place.name || "Unknown Restaurant",
    rating: place.rating || 0,
    review_count: place.user_ratings_total || 0,
    price_range: place.price_level ? "$".repeat(place.price_level) : "$$",
    cuisine_types:
      place.types?.filter(
        (type) => !["establishment", "point_of_interest", "food"].includes(type)
      ) || [],
    address: place.vicinity || place.formatted_address || "",
    phone: place.formatted_phone_number || "",
    specialties: place.types?.join(", ") || "Local cuisine",
    distance: "Near " + location_name,
    why_recommended:
      place.rating >= 4.0
        ? "Highly rated by Google users"
        : "Local establishment",
    image_url: place.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_PLACES_API_KEY}`
      : null,
    is_open: place.opening_hours?.open_now ? "Open now" : "Check hours",
    url: place.website || null,
    place_id: place.place_id,
  };
}

function mapGooglePlacesToHotel(place, location_name) {
  return {
    name: place.name || "Unknown Hotel",
    rating: place.rating || 0,
    review_count: place.user_ratings_total || 0,
    price_category: place.price_level ? "$".repeat(place.price_level) : "$$",
    address: place.vicinity || place.formatted_address || "",
    phone: place.formatted_phone_number || "",
    amenity_highlights:
      place.types?.filter(
        (type) =>
          !["establishment", "point_of_interest", "lodging"].includes(type)
      ) || [],
    distance_from_center: "Central " + location_name,
    booking_appeal:
      place.rating >= 4.0
        ? "Highly rated accommodation"
        : "Local lodging option",
    neighborhood_vibe: "Convenient location",
    image_url: place.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_PLACES_API_KEY}`
      : null,
    url: place.website || null,
    is_open:
      place.opening_hours?.open_now !== false
        ? "Operating"
        : "Check availability",
    place_id: place.place_id,
  };
}


function isLikelyHigherEndHotelName(name = "") {
  return /\b(radisson|soaltee|shanker|autograph|marriott|hyatt|hilton|sheraton|intercontinental|crowne|luxury|resort|palace)\b/i.test(String(name));
}

function accommodationBudgetScore(place = {}) {
  const name = String(place.name || "");
  const types = Array.isArray(place.types) ? place.types.join(" ").toLowerCase() : "";
  let score = 0;
  if (/hostel|guesthouse|guest house|homestay|inn|lodge|backpacker|budget/i.test(name)) score += 8;
  if (/hostel|guest_house|lodging|campground|rv_park/.test(types)) score += 3;
  if (place.price_level === 1) score += 4;
  if (!place.price_level) score += 1;
  if (place.rating >= 4.0) score += 1;
  if (isLikelyHigherEndHotelName(name)) score -= 10;
  if (place.price_level >= 3) score -= 8;
  return score;
}

// Tool handlers with coordinate conversion
const toolHandlers = {
  // Weather tool with string coordinate handling
  async comprehensive_weather_analysis({ latitude, longitude, location_name }) {
    try {
      // FIXED: Convert string coordinates to numbers if needed
      const lat =
        typeof latitude === "string" ? parseFloat(latitude) : latitude;
      const lon =
        typeof longitude === "string" ? parseFloat(longitude) : longitude;

      // Validate after conversion
      if (!lat || !lon || !location_name) {
        throw new Error(
          "Missing required parameters: latitude, longitude, and location_name are required"
        );
      }

      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error(
          `Invalid latitude: ${latitude}. Must be a number between -90 and 90`
        );
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        throw new Error(
          `Invalid longitude: ${longitude}. Must be a number between -180 and 180`
        );
      }

      if (!process.env.OPEN_WEATHER_KEY) {
        throw new Error("Weather service not configured");
      }

      const weatherRequest = async () => {
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPEN_WEATHER_KEY}&units=metric`;
        const currentRes = await APIRequestManager.makeRequest(
          currentUrl,
          {},
          "weather"
        );

        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${process.env.OPEN_WEATHER_KEY}&units=metric`;
        const forecastRes = await APIRequestManager.makeRequest(
          forecastUrl,
          {},
          "weather"
        );

        return { current: currentRes.data, forecast: forecastRes.data };
      };

      const { current, forecast } = await APIRequestManager.retryRequest(
        weatherRequest,
        "weather"
      );

      if (!current.main || !current.weather) {
        throw new Error("Invalid weather data received");
      }

      const analysis = {
        location: location_name,
        current_conditions: {
          temperature: Math.round(current.main.temp),
          feels_like: Math.round(current.main.feels_like),
          humidity: current.main.humidity,
          description: current.weather[0].description,
          wind_speed: Math.round(current.wind?.speed || 0),
          visibility: current.visibility
            ? Math.round(current.visibility / 1000)
            : "N/A",
          pressure: current.main.pressure,
          weather_icon: current.weather[0].icon,
        },
        forecast_summary: forecast.list.slice(0, 8).map((item) => ({
          time: new Date(item.dt * 1000).toLocaleString(),
          temp: Math.round(item.main.temp),
          description: item.weather[0].description,
          rain_probability: Math.round(item.pop * 100),
          wind_speed: Math.round(item.wind?.speed || 0),
        })),
        travel_recommendations: {
          best_time_to_visit: getWeatherAdvice(
            current.main.temp,
            current.weather[0].main
          ),
          clothing_suggestions: getClothingAdvice(
            current.main.temp,
            current.weather[0].main
          ),
          outdoor_activities: getActivityAdvice(
            current.weather[0].main,
            current.wind?.speed || 0
          ),
          weather_alerts: getWeatherAlerts(current, forecast),
        },
        data_freshness: new Date().toISOString(),
      };

      return analysis;
    } catch (error) {
      console.error("Weather API error:", error.message);
      return {
        error: `Weather data temporarily unavailable: ${error.message}`,
        location: location_name,
        fallback_advice:
          "Check reliable weather services like Weather.com or local meteorological services for current conditions.",
      };
    }
  },

  // Restaurant search with string coordinate handling
  async intelligent_restaurant_discovery({
    lat,
    lon,
    location_name,
    cuisine_preference = "local traditional",
    budget_level = "any",
  }) {
    try {
      // FIXED: Convert string coordinates to numbers if needed
      const latitude = typeof lat === "string" ? parseFloat(lat) : lat;
      const longitude = typeof lon === "string" ? parseFloat(lon) : lon;

      if (!process.env.GOOGLE_PLACES_API_KEY) {
        throw new Error("Google Places API not configured");
      }

      const radius = 5000;

      const restaurantRequest = async () => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=restaurant&key=${process.env.GOOGLE_PLACES_API_KEY}`;

        return await APIRequestManager.makeRequest(url, {}, "google_places");
      };

      const response = await APIRequestManager.retryRequest(
        restaurantRequest,
        "google_places"
      );

      if (!response.data.results || response.data.results.length === 0) {
        throw new Error("No restaurants found in the area");
      }

      let restaurants = response.data.results.slice(0, 10);

      // Filter by budget if specified
      if (budget_level !== "any") {
        const budgetMap = {
          budget: [1, 2],
          "mid-range": [2, 3],
          luxury: [3, 4],
        };
        const allowedPrices = budgetMap[budget_level];
        if (allowedPrices) {
          restaurants = restaurants.filter(
            (r) => !r.price_level || allowedPrices.includes(r.price_level)
          );
        }
      }

      const enhancedRestaurants = restaurants.map((place) =>
        mapGooglePlacesToRestaurant(place, location_name)
      );

      return {
        location: location_name,
        cuisine_focus: cuisine_preference,
        restaurants: enhancedRestaurants,
        local_food_culture: `Exploring ${
          cuisine_preference === "local traditional"
            ? "local"
            : cuisine_preference
        } dining scene in ${location_name}`,
        dining_tips:
          "Check Google reviews and opening hours before visiting. Many restaurants accept reservations through their websites.",
        search_metadata: {
          total_found: enhancedRestaurants.length,
          search_radius: "5km",
          budget_filter: budget_level,
          source: "google_places_api",
          api_status: response.data.status,
        },
      };
    } catch (error) {
      console.error("Google Places restaurant API error:", error.message);
      return {
        error: `Restaurant search temporarily unavailable: ${error.message}`,
        location: location_name,
        fallback_advice:
          "Try searching on Google Maps, TripAdvisor, or ask locals for restaurant recommendations.",
      };
    }
  },

  // Accommodation search with string coordinate handling
  async smart_accommodation_finder({
    lat,
    lon,
    location_name,
    budget_category = "$$",
    stay_type = "hotel",
  }) {
    try {
      // FIXED: Convert string coordinates to numbers if needed
      const latitude = typeof lat === "string" ? parseFloat(lat) : lat;
      const longitude = typeof lon === "string" ? parseFloat(lon) : lon;

      if (!process.env.GOOGLE_PLACES_API_KEY) {
        throw new Error("Google Places API not configured");
      }

      const radius = 10000;

      const accommodationRequest = async () => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=lodging&key=${process.env.GOOGLE_PLACES_API_KEY}`;

        return await APIRequestManager.makeRequest(url, {}, "google_places");
      };

      const response = await APIRequestManager.retryRequest(
        accommodationRequest,
        "google_places"
      );

      if (!response.data.results || response.data.results.length === 0) {
        throw new Error("No accommodations found in the area");
      }

      let accommodations = response.data.results || [];

      // Filter and rank by budget category if specified. Google Places often returns
      // well-known hotels even for budget requests, so we explicitly demote
      // higher-end brands and prioritize hostels, guesthouses, homestays and simple lodgings.
      const normalizedBudget = String(budget_category || "$$").trim();
      const budgetMap = { $: [0, 1], $$: [0, 1, 2], $$$: [2, 3], $$$$: [3, 4] };
      const allowedPrices = budgetMap[normalizedBudget];

      if (allowedPrices) {
        accommodations = accommodations.filter((place) => {
          const priceLevel = place.price_level ?? 0;
          if (normalizedBudget === "$" && isLikelyHigherEndHotelName(place.name)) {
            return false;
          }
          return allowedPrices.includes(priceLevel) || !place.price_level;
        });
      }

      if (normalizedBudget === "$" || /hostel|guesthouse|guest house|homestay|budget/i.test(String(stay_type))) {
        accommodations = accommodations
          .sort((a, b) => accommodationBudgetScore(b) - accommodationBudgetScore(a))
          .slice(0, 8);
      } else {
        accommodations = accommodations.slice(0, 8);
      }

      const enhancedAccommodations = accommodations.map((place) =>
        mapGooglePlacesToHotel(place, location_name)
      );

      return {
        location: location_name,
        accommodation_type: stay_type,
        budget_range: budget_category,
        properties: enhancedAccommodations,
        booking_insights:
          normalizedBudget === "$"
            ? "Google Places does not provide guaranteed live booking rates. Use this shortlist as a discovery layer, then confirm exact nightly prices, taxes and availability on booking platforms or property websites."
            : "Check multiple booking platforms for final rates, taxes, availability and recent reviews.",
        local_context:
          normalizedBudget === "$"
            ? `${location_name} budget stays are best compared by area, recent reviews and final price after fees.`
            : `${location_name} offers lodging options across different comfort and price levels`,
        search_metadata: {
          total_found: enhancedAccommodations.length,
          search_radius: "10km",
          budget_category: budget_category,
          property_type: stay_type,
          source: "google_places_api",
          api_status: response.data.status,
        },
      };
    } catch (error) {
      console.error("Google Places accommodation API error:", error.message);
      return {
        error: `Accommodation search temporarily unavailable: ${error.message}`,
        location: location_name,
        fallback_advice:
          "Check booking platforms like Booking.com, Hotels.com, or Airbnb for accommodation options.",
      };
    }
  },

  // Attractions search with string coordinate handling
  async local_experiences_and_attractions({
    lat,
    lon,
    location_name,
    interest_type = "attractions",
  }) {
    try {
      // FIXED: Convert string coordinates to numbers if needed
      const latitude = typeof lat === "string" ? parseFloat(lat) : lat;
      const longitude = typeof lon === "string" ? parseFloat(lon) : lon;

      if (!process.env.GOOGLE_PLACES_API_KEY) {
        throw new Error("Google Places API not configured");
      }

      const radius = 15000;

      const typeMapping = {
        attractions: ["tourist_attraction", "museum", "amusement_park"],
        activities: ["tourist_attraction", "gym", "bowling_alley"],
        nature: ["park", "zoo", "natural_feature"],
        culture: ["museum", "art_gallery", "library"],
        nightlife: ["night_club", "bar"],
        shopping: ["shopping_mall", "store"],
        sports: ["stadium", "gym", "bowling_alley"],
      };

      const searchTypes = typeMapping[interest_type] || typeMapping.attractions;

      const attractionRequest = async () => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=${searchTypes[0]}&key=${process.env.GOOGLE_PLACES_API_KEY}`;

        return await APIRequestManager.makeRequest(url, {}, "google_places");
      };

      const response = await APIRequestManager.retryRequest(
        attractionRequest,
        "google_places"
      );

      if (!response.data.results || response.data.results.length === 0) {
        throw new Error(`No ${interest_type} found in the area`);
      }

      const attractions = response.data.results.slice(0, 10);

      const enhancedAttractions = attractions.map((place) => ({
        name: place.name || "Local Attraction",
        category:
          place.types
            ?.filter(
              (type) => !["establishment", "point_of_interest"].includes(type)
            )
            .join(", ") || interest_type,
        rating: place.rating || 0,
        review_count: place.user_ratings_total || 0,
        address: place.vicinity || place.formatted_address || "",
        distance: "Within " + location_name + " area",
        why_visit:
          place.rating >= 4.0
            ? "Highly rated by visitors"
            : "Local point of interest",
        experience_type: place.types?.join(", ") || "Local experience",
        image_url: place.photos?.[0]
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_PLACES_API_KEY}`
          : null,
        phone: place.formatted_phone_number || "",
        url: place.website || null,
        is_open:
          place.opening_hours?.open_now !== false ? "Open" : "Check hours",
        price_level: place.price_level
          ? "$".repeat(place.price_level)
          : "Free/Varies",
        place_id: place.place_id,
      }));

      return {
        location: location_name,
        experience_category: interest_type,
        recommendations: enhancedAttractions,
        local_context: `${location_name} offers diverse ${interest_type} that showcase the area's unique character`,
        planning_tips:
          "Check Google Maps for current hours and reviews. Some attractions may require advance booking.",
        search_metadata: {
          total_found: enhancedAttractions.length,
          search_radius: "15km",
          search_types: searchTypes,
          category: interest_type,
          source: "google_places_api",
          api_status: response.data.status,
        },
      };
    } catch (error) {
      console.error("Google Places attractions API error:", error.message);
      return {
        error: `Attraction search temporarily unavailable: ${error.message}`,
        location: location_name,
        fallback_advice:
          "Check Google Maps, TripAdvisor, or local tourism websites for attraction information.",
      };
    }
  },

  // Safety intelligence tool (no coordinates needed)
  async comprehensive_safety_intelligence({
    location,
    country,
    specific_concerns = "general",
  }) {
    try {
      if (!process.env.NEWS_API_KEY) {
        throw new Error("Safety intelligence service not configured");
      }

      const searchQueries = [
        `${country} travel advisory security situation 2024 2025`,
        `${location} current safety tourists security update`,
        `${country} political stability government travel`,
        `${location} crime statistics tourist safety recent`,
        `${country} border situation entry requirements security`,
        `${location} infrastructure security medical facilities`,
        specific_concerns !== "general"
          ? `${location} ${specific_concerns} travel security risk`
          : null,
      ].filter(Boolean);

      const safetyRequest = async () => {
        const newsPromises = searchQueries.map((query) => {
          const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
            query
          )}&sortBy=publishedAt&pageSize=8&language=en&apiKey=${
            process.env.NEWS_API_KEY
          }`;

          return APIRequestManager.makeRequest(url, {}, "news").catch(() => ({
            data: { articles: [] },
          }));
        });

        return Promise.all(newsPromises);
      };

      const results = await APIRequestManager.retryRequest(
        safetyRequest,
        "news"
      );
      const allArticles = results
        .flatMap((res) => res.data.articles || [])
        .filter(
          (article) =>
            article.title &&
            article.publishedAt &&
            article.description &&
            article.source.name !== "[Removed]"
        )
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, 15);

      const safetyKeywords = {
        critical_risk: [
          "war",
          "warfare",
          "armed conflict",
          "invasion",
          "bombing",
          "missile",
          "rocket",
          "siege",
        ],
        high_risk: [
          "terrorism",
          "terrorist",
          "violence",
          "violent",
          "dangerous",
          "avoid travel",
          "evacuate",
          "emergency",
        ],
        medium_risk: [
          "unrest",
          "protest",
          "demonstration",
          "strike",
          "caution",
          "careful",
          "alert",
          "concern",
          "incident",
        ],
        crime_risk: [
          "crime",
          "theft",
          "robbery",
          "kidnapping",
          "assault",
          "murder",
          "gang",
        ],
        health_risk: [
          "outbreak",
          "epidemic",
          "disease",
          "medical",
          "hospital",
          "health emergency",
        ],
        positive: [
          "safe",
          "secure",
          "stable",
          "peaceful",
          "friendly",
          "welcome",
          "improving",
          "normalizing",
        ],
      };

      let riskScore = 0;
      const riskFactors = [];

      allArticles.forEach((article) => {
        const text = (
          article.title +
          " " +
          (article.description || "")
        ).toLowerCase();
        const articleAge = Date.now() - new Date(article.publishedAt).getTime();
        const recencyMultiplier = articleAge < 7 * 24 * 60 * 60 * 1000 ? 2 : 1;

        Object.entries(safetyKeywords).forEach(([category, keywords]) => {
          keywords.forEach((keyword) => {
            if (text.includes(keyword)) {
              let score = 0;
              switch (category) {
                case "critical_risk":
                  score = 10;
                  break;
                case "high_risk":
                  score = 6;
                  break;
                case "medium_risk":
                  score = 3;
                  break;
                case "crime_risk":
                  score = 4;
                  break;
                case "health_risk":
                  score = 3;
                  break;
                case "positive":
                  score = -2;
                  break;
              }
              riskScore += score * recencyMultiplier;
              if (score > 0) {
                riskFactors.push({
                  factor: keyword,
                  category: category,
                  source: article.source.name,
                  date: article.publishedAt,
                });
              }
            }
          });
        });
      });

      const getRiskLevel = (score) => {
        if (score > 30) return "CRITICAL RISK";
        if (score > 20) return "HIGH RISK";
        if (score > 10) return "ELEVATED RISK";
        if (score > 5) return "MODERATE RISK";
        if (score > 0) return "LOW RISK";
        return "MINIMAL RISK";
      };

      const safetyLevel = getRiskLevel(riskScore);

      const assessment = {
        location,
        country,
        safety_assessment: {
          overall_risk_level: safetyLevel,
          risk_score: Math.max(0, Math.round(riskScore)),
          confidence_level:
            allArticles.length > 5
              ? "HIGH"
              : allArticles.length > 2
              ? "MEDIUM"
              : "LOW",
          assessment_date: new Date().toISOString(),
          data_sources: allArticles.length,
        },
        threat_analysis: {
          primary_concerns: riskFactors.slice(0, 5).map((factor) => ({
            threat_type: factor.category.replace("_", " ").toUpperCase(),
            specific_factor: factor.factor,
            source_reliability: assessSourceReliability(factor.source),
            recency: getRecencyDescription(factor.date),
          })),
          trending_risks: identifyTrendingRisks(riskFactors),
        },
        current_situation: allArticles.slice(0, 6).map((article) => ({
          headline: article.title,
          source: article.source.name,
          published: new Date(article.publishedAt).toLocaleDateString(),
          summary:
            (article.description?.substring(0, 150) || "No summary available") +
            "...",
          url: article.url,
          relevance_score: calculateRelevanceScore(article, location, country),
        })),
        professional_recommendations: generateSecurityRecommendations(
          safetyLevel,
          location,
          country,
          specific_concerns
        ),
        emergency_protocols: {
          embassy_contact: `Contact your embassy/consulate in ${country} immediately upon arrival`,
          emergency_numbers:
            "Research local emergency service numbers (police, medical, fire)",
          communication_plan:
            "Establish regular check-ins with family/colleagues",
          evacuation_planning:
            safetyLevel.includes("HIGH") || safetyLevel.includes("CRITICAL")
              ? "Develop and communicate evacuation contingency plans"
              : "Standard emergency preparedness recommended",
        },
        intelligence_sources: {
          official_advisories: `Check ${getOfficialAdvisorySource()} for current travel advisories`,
          real_time_monitoring:
            "Monitor local news and official communications",
          professional_security:
            safetyLevel.includes("HIGH") || safetyLevel.includes("CRITICAL")
              ? "Consider professional security consultation"
              : "Standard precautions sufficient",
        },
        data_freshness: new Date().toISOString(),
      };

      return assessment;
    } catch (error) {
      console.error("Safety intelligence API error:", error.message);
      return {
        error: `Safety intelligence temporarily unavailable: ${error.message}`,
        location,
        country,
        fallback_guidance: `For ${location}, consult official government travel advisories and embassy resources for current security information.`,
        emergency_advice:
          "In case of immediate danger, contact local emergency services and your embassy.",
      };
    }
  },

  // Cultural insights tool (no coordinates needed)
  async cultural_and_travel_insights({
    location,
    country,
    insight_type = "culture",
  }) {
    try {
      if (!process.env.NEWS_API_KEY) {
        throw new Error("Cultural insights service not configured");
      }

      const searchQueries = {
        culture: [
          `${country} culture customs traditions etiquette`,
          `${location} cultural experiences traditions`,
        ],
        visa: [
          `${country} visa requirements tourism entry 2024 2025`,
          `${country} passport travel requirements`,
        ],
        currency: [
          `${country} currency exchange rates money`,
          `${location} payment methods tourists`,
        ],
        language: [
          `${country} language communication tourists`,
          `${location} English speaking locals`,
        ],
        tourism: [
          `${country} tourism infrastructure friendly`,
          `${location} tourist attractions experiences`,
        ],
        general: [
          `${country} travel guide culture tourism`,
          `${location} visitor information cultural context`,
        ],
      };

      const queries = searchQueries[insight_type] || searchQueries.general;

      const culturalRequest = async () => {
        const newsPromises = queries.map((query) => {
          const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
            query
          )}&sortBy=relevancy&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`;

          return APIRequestManager.makeRequest(url, {}, "news").catch(() => ({
            data: { articles: [] },
          }));
        });

        return Promise.all(newsPromises);
      };

      const results = await APIRequestManager.retryRequest(
        culturalRequest,
        "news"
      );
      const relevantArticles = results
        .flatMap((res) => res.data.articles || [])
        .filter((article) => article.title && article.description)
        .slice(0, 8);

      return {
        location,
        country,
        insight_category: insight_type,
        cultural_intelligence: relevantArticles.map((article) => ({
          topic: article.title,
          insights: article.description,
          source: article.source.name,
          relevance: "Cultural and travel context",
          url: article.url,
          published: new Date(article.publishedAt).toLocaleDateString(),
        })),
        practical_tips: getCulturalTips(insight_type, country),
        travel_context: `Understanding ${country}'s cultural landscape enhances your travel experience significantly`,
        data_freshness: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Cultural insights API error:", error.message);
      return {
        error: `Cultural insights temporarily unavailable: ${error.message}`,
        location,
        country,
        fallback_advice:
          "Consult official tourism boards, embassy websites, and reputable travel guides for cultural information.",
      };
    }
  },
};

// Helper functions for cultural tips
function getCulturalTips(insightType, country) {
  const baseTips = {
    cultural_etiquette:
      "Research local customs and dress codes before visiting",
    communication: "Learn basic phrases in the local language",
    respect: "Be mindful of local traditions and religious practices",
    interaction:
      "Engage with locals respectfully and show genuine interest in their culture",
  };

  const specificTips = {
    culture: {
      ...baseTips,
      dining: "Understand local dining customs and table manners",
      gestures: "Be aware of gestures that might be offensive",
    },
    visa: {
      documentation: "Ensure passport validity and required visas",
      entry_requirements:
        "Check health certificates and vaccination requirements",
      processing_time: "Apply for visas well in advance",
      embassy_contact: "Register with your embassy upon arrival",
    },
    currency: {
      exchange: "Use official exchange services and avoid street exchangers",
      cards: "Inform banks of travel plans to avoid card blocks",
      cash: "Carry some local currency for small vendors",
      tipping: "Research local tipping customs and expectations",
    },
    language: {
      basic_phrases: "Learn hello, thank you, and excuse me",
      translation_apps: "Download offline translation apps",
      patience: "Be patient with language barriers",
      non_verbal: "Use gestures and smiles to communicate",
    },
  };

  return specificTips[insightType] || baseTips;
}

// Tool execution service
export const toolService = {
  getTools() {
    return tools;
  },

  async executeTool(toolName, args) {
    const handler = toolHandlers[toolName];
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const toolDefinition = tools.find((t) => t.function.name === toolName);
    if (toolDefinition) {
      const required = toolDefinition.function.parameters.required || [];
      for (const param of required) {
        if (args[param] === undefined || args[param] === null) {
          throw new Error(`Missing required parameter: ${param}`);
        }
      }
    }

    try {
      console.log(
        `🔧 Executing tool: ${toolName} with args:`,
        JSON.stringify(args, null, 2)
      );

      const startTime = Date.now();
      const result = await handler(args);
      const executionTime = Date.now() - startTime;

      console.log(
        `✅ Tool ${toolName} completed successfully in ${executionTime}ms`
      );

      if (result && typeof result === "object" && !result.error) {
        result.execution_metadata = {
          tool_name: toolName,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString(),
        };
      }

      return result;
    } catch (error) {
      console.error(`❌ Tool ${toolName} execution failed:`, error.message);

      return {
        error: `${toolName} execution failed: ${error.message}`,
        tool_name: toolName,
        suggestion: this.getErrorSuggestion(toolName, error.message),
        fallback_available: true,
        timestamp: new Date().toISOString(),
      };
    }
  },

  getErrorSuggestion(toolName, errorMessage) {
    const suggestions = {
      comprehensive_weather_analysis:
        "Try checking reliable weather websites like Weather.com or local meteorological services",
      intelligent_restaurant_discovery:
        "Try searching on Google Maps, TripAdvisor, or ask locals for recommendations",
      smart_accommodation_finder:
        "Check booking platforms like Booking.com, Hotels.com, or contact local tourism offices",
      comprehensive_safety_intelligence:
        "Consult official government travel advisories and embassy websites for security information",
      cultural_and_travel_insights:
        "Visit official tourism board websites and reputable travel guide publishers",
      local_experiences_and_attractions:
        "Check Google Maps, TripAdvisor, or local tourism websites for attraction information",
    };

    return (
      suggestions[toolName] ||
      "Try alternative sources or contact local tourism services"
    );
  },

  getToolDefinition(toolName) {
    return tools.find((t) => t.function.name === toolName);
  },

  getAllToolNames() {
    return tools.map((t) => t.function.name);
  },

  validateToolArgs(toolName, args) {
    const toolDefinition = this.getToolDefinition(toolName);
    if (!toolDefinition) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const required = toolDefinition.function.parameters.required || [];
    const properties = toolDefinition.function.parameters.properties || {};

    for (const param of required) {
      if (
        args[param] === undefined ||
        args[param] === null ||
        args[param] === ""
      ) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }

    // FIXED: Convert string coordinates to numbers during validation
    for (const [param, value] of Object.entries(args)) {
      const propDef = properties[param];
      if (propDef) {
        // Handle coordinate conversion
        if (
          Array.isArray(propDef.type) &&
          propDef.type.includes("number") &&
          typeof value === "string"
        ) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            args[param] = numValue; // Convert string to number
            continue;
          }
        }

        // Type checking after conversion
        const actualType = typeof args[param];
        const expectedTypes = Array.isArray(propDef.type)
          ? propDef.type
          : [propDef.type];

        if (!expectedTypes.includes(actualType)) {
          throw new Error(
            `Parameter ${param} must be one of: ${expectedTypes.join(
              ", "
            )}, got ${actualType}`
          );
        }
      }
    }

    return true;
  },

  async healthCheck() {
    const services = [
      { name: "OpenWeather", check: () => this.checkWeatherAPI() },
      { name: "GooglePlaces", check: () => this.checkGooglePlacesAPI() },
      { name: "NewsAPI", check: () => this.checkNewsAPI() },
    ];

    const results = await Promise.allSettled(
      services.map(async (service) => ({
        name: service.name,
        status: (await service.check()) ? "healthy" : "unhealthy",
      }))
    );

    return {
      timestamp: new Date().toISOString(),
      services: results.map((result) =>
        result.status === "fulfilled"
          ? result.value
          : { name: "unknown", status: "error" }
      ),
      overall: results.every(
        (r) => r.status === "fulfilled" && r.value.status === "healthy"
      )
        ? "healthy"
        : "degraded",
    };
  },

  async checkWeatherAPI() {
    if (!process.env.OPEN_WEATHER_KEY) return false;
    try {
      await APIRequestManager.makeRequest(
        `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${process.env.OPEN_WEATHER_KEY}`,
        { timeout: 5000 },
        "weather"
      );
      return true;
    } catch {
      return false;
    }
  },

  async checkGooglePlacesAPI() {
    if (!process.env.GOOGLE_PLACES_API_KEY) return false;
    try {
      await APIRequestManager.makeRequest(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=40.7128,-74.0060&radius=1000&type=restaurant&key=${process.env.GOOGLE_PLACES_API_KEY}`,
        { timeout: 5000 },
        "google_places"
      );
      return true;
    } catch {
      return false;
    }
  },

  async checkNewsAPI() {
    if (!process.env.NEWS_API_KEY) return false;
    try {
      await APIRequestManager.makeRequest(
        `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${process.env.NEWS_API_KEY}`,
        { timeout: 5000 },
        "news"
      );
      return true;
    } catch {
      return false;
    }
  },
};

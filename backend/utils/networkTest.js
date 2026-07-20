// utils/networkTest.js - Network connectivity testing for ATLAS backend
import axios from "axios";

function googlePlacesKey() {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY || "";
}

function googlePlacesHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": googlePlacesKey(),
    "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.location,places.types",
  };
}

async function googlePlacesTextSearch(textQuery, { maxResultCount = 5, locationBias } = {}) {
  const key = googlePlacesKey();
  if (!key) throw new Error("GOOGLE_MAPS_SERVER_API_KEY is not configured");

  const body = {
    textQuery,
    maxResultCount: Math.max(1, Math.min(Number(maxResultCount) || 5, 20)),
  };
  if (locationBias) body.locationBias = locationBias;

  const response = await axios.post(
    "https://places.googleapis.com/v1/places:searchText",
    body,
    {
      headers: googlePlacesHeaders(),
      timeout: 8000,
      validateStatus: (status) => status < 500,
    }
  );

  const places = Array.isArray(response.data?.places) ? response.data.places : [];
  const apiStatus = response.status === 200 ? (places.length ? "OK" : "ZERO_RESULTS") : "FAILED";

  if (response.status >= 400) {
    return {
      success: false,
      status: response.status,
      api_status: apiStatus,
      error: response.data?.error?.message || `Places API (New) returned HTTP ${response.status}`,
      details: response.data,
    };
  }

  return {
    success: true,
    status: response.status,
    results_count: places.length,
    api_status: apiStatus,
    sample: places.slice(0, 3).map((place) => ({
      name: place.displayName?.text,
      address: place.formattedAddress,
      rating: place.rating,
    })),
  };
}

export const networkTest = {
  async testGroqConnectivity() {
    try {
      console.log("🔍 Testing Groq API connectivity...");

      const response = await axios.get("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        timeout: 10000,
      });

      console.log("✅ Groq API is reachable");
      return { success: true, status: response.status };
    } catch (error) {
      console.error("❌ Groq API connectivity test failed:", error.message);
      return {
        success: false,
        error: error.message,
        code: error.code,
        status: error.response?.status,
      };
    }
  },

  async testAllAPIs() {
    const [groq, google, google_timezone, google_routes, openweather, googleplaces, news] = await Promise.all([
      this.testGroqConnectivity(),
      this.testGoogleMaps(),
      this.testGoogleTimeZone(),
      this.testGoogleRoutes(),
      this.testOpenWeather(),
      this.testGooglePlaces(),
      this.testNewsAPI(),
    ]);
    const results = { groq, google, google_timezone, google_routes, openweather, googleplaces, news };

    console.log("📊 API Connectivity Results:", results);
    return results;
  },

  async testGoogleMaps() {
    try {
      const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
      if (!key) return { success: false, error: "GOOGLE_MAPS_SERVER_API_KEY is not configured" };
      const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
        params: { address: "Helsinki", key },
        timeout: 5000,
      });
      const apiStatus = response.data?.status;
      return {
        success: response.status === 200 && ["OK", "ZERO_RESULTS"].includes(apiStatus),
        status: response.status,
        api_status: apiStatus,
        error: ["OK", "ZERO_RESULTS"].includes(apiStatus) ? undefined : response.data?.error_message || apiStatus,
      };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.response?.status };
    }
  },

  async testGoogleTimeZone() {
    try {
      const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
      if (!key) return { success: false, error: "GOOGLE_MAPS_SERVER_API_KEY is not configured" };
      const response = await axios.get("https://maps.googleapis.com/maps/api/timezone/json", {
        params: { location: "60.1699,24.9384", timestamp: Math.floor(Date.now() / 1000), key },
        timeout: 5000,
      });
      const apiStatus = response.data?.status;
      return {
        success: response.status === 200 && apiStatus === "OK",
        status: response.status,
        api_status: apiStatus,
        time_zone_id: response.data?.timeZoneId,
        error: apiStatus === "OK" ? undefined : response.data?.errorMessage || apiStatus,
      };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.response?.status };
    }
  },

  async testGoogleRoutes() {
    try {
      const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
      if (!key) return { success: false, error: "GOOGLE_MAPS_SERVER_API_KEY is not configured" };
      const response = await axios.post(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          origin: { address: "Helsinki railway station" },
          destination: { address: "Helsinki airport" },
          travelMode: "TRANSIT",
          languageCode: "en-US",
          units: "METRIC",
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
          },
          timeout: 8000,
          validateStatus: (status) => status < 500,
        },
      );
      const routes = Array.isArray(response.data?.routes) ? response.data.routes : [];
      return {
        success: response.status === 200 && routes.length > 0,
        status: response.status,
        routes_count: routes.length,
        error: response.status >= 400 ? response.data?.error?.message || `Routes API returned HTTP ${response.status}` : undefined,
      };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.response?.status };
    }
  },

  async testOpenWeather() {
    try {
      const key = process.env.OPEN_WEATHER_KEY || process.env.OPENWEATHER_API_KEY;
      if (!key) return { success: false, error: "OpenWeather API key is not configured" };
      const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
        params: { lat: 60.1699, lon: 24.9384, appid: key },
        timeout: 5000,
      });
      return { success: response.status === 200, status: response.status };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.response?.status };
    }
  },

  async testGooglePlaces() {
    try {
      return await googlePlacesTextSearch("tennis courts in Riihimäki Finland", { maxResultCount: 3 });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        status: error.response?.status,
        details: error.response?.data,
      };
    }
  },

  async testNewsAPI() {
    try {
      if (!process.env.NEWS_API_KEY) return { success: false, error: "News API key is not configured" };
      const response = await axios.get("https://newsapi.org/v2/top-headlines", {
        params: { country: "us", pageSize: 1, apiKey: process.env.NEWS_API_KEY },
        timeout: 5000,
      });
      return { success: response.status === 200 && response.data?.status === "ok", status: response.status, api_status: response.data?.status };
    } catch (error) {
      return { success: false, error: error.message, code: error.code, status: error.response?.status };
    }
  },

  async testGooglePlacesDetailed() {
    try {
      console.log("🔍 Testing Google Places API (New) with detailed diagnostics...");

      const restaurantTest = await googlePlacesTextSearch("restaurants in New York City", { maxResultCount: 5 });
      const hotelTest = await googlePlacesTextSearch("hotels in London", { maxResultCount: 5 });
      const attractionTest = await googlePlacesTextSearch("tourist attractions in Paris", { maxResultCount: 5 });

      console.log(`✅ Google Places restaurant search: Found ${restaurantTest.results_count || 0} results`);
      console.log(`✅ Google Places hotel search: Found ${hotelTest.results_count || 0} results`);
      console.log(`✅ Google Places attraction search: Found ${attractionTest.results_count || 0} results`);

      const allSuccessful = [restaurantTest, hotelTest, attractionTest].every((result) => result.success);
      return {
        success: allSuccessful,
        status: allSuccessful ? 200 : 400,
        restaurant_results: restaurantTest.results_count || 0,
        hotel_results: hotelTest.results_count || 0,
        attraction_results: attractionTest.results_count || 0,
        api_status: allSuccessful ? "OK" : "PARTIAL_FAILURE",
        details: { restaurantTest, hotelTest, attractionTest },
      };
    } catch (error) {
      console.error("❌ Detailed Google Places test failed:", error.message);
      return {
        success: false,
        error: error.message,
        code: error.code,
        status: error.response?.status,
        details: error.response?.data,
      };
    }
  },

  async performanceTest() {
    console.log("🚀 Running API performance tests...");
    const results = {};

    const apis = [
      { name: "groq", test: () => this.testGroqConnectivity() },
      { name: "openweather", test: () => this.testOpenWeather() },
      { name: "googleplaces", test: () => this.testGooglePlaces() },
      { name: "googletimezone", test: () => this.testGoogleTimeZone() },
      { name: "googleroutes", test: () => this.testGoogleRoutes() },
      { name: "news", test: () => this.testNewsAPI() },
      { name: "google", test: () => this.testGoogleMaps() },
    ];

    for (const api of apis) {
      const startTime = Date.now();
      try {
        const result = await api.test();
        const responseTime = Date.now() - startTime;

        results[api.name] = {
          ...result,
          responseTime: `${responseTime}ms`,
          performance: responseTime < 1000 ? "fast" : responseTime < 3000 ? "moderate" : "slow",
        };

        console.log(`📊 ${api.name.toUpperCase()}: ${responseTime}ms (${results[api.name].performance})`);
      } catch (error) {
        results[api.name] = {
          success: false,
          error: error.message,
          responseTime: `${Date.now() - startTime}ms (timeout)`,
        };
      }
    }

    return results;
  },

  async testGooglePlacesQuota() {
    try {
      console.log("💰 Testing Google Places API (New) quota usage...");
      const startTime = Date.now();
      const testRequests = [
        googlePlacesTextSearch("restaurants in New York City", { maxResultCount: 3 }),
        googlePlacesTextSearch("hotels in London", { maxResultCount: 3 }),
        googlePlacesTextSearch("tourist attractions in Paris", { maxResultCount: 3 }),
      ];

      const results = await Promise.allSettled(testRequests);
      const successCount = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
      const totalTime = Date.now() - startTime;
      console.log(`✅ Google Places quota test: ${successCount}/3 requests succeeded in ${totalTime}ms`);

      const avgResponseTime = totalTime / 3;
      const successRate = successCount / 3;

      return {
        success: successCount === 3,
        successful_requests: successCount,
        total_requests: 3,
        success_rate: Math.round(successRate * 100) + "%",
        average_response_time: Math.round(avgResponseTime) + "ms",
        estimated_monthly_cost: this.estimateMonthlyCost(1000),
        quota_status: successCount === 3 ? "healthy" : "partial",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        quota_status: "unknown",
      };
    }
  },

  estimateMonthlyCost(monthlyRequests) {
    // Places API (New) pricing depends on field masks and SKU. Keep this as a rough planning estimate only.
    const costPerThousand = 32;
    const estimatedCost = (monthlyRequests / 1000) * costPerThousand;

    return {
      requests: monthlyRequests,
      estimated_cost_usd: `$${estimatedCost.toFixed(2)}`,
      note: "Rough estimate only. Check current Google Maps Platform pricing for Places API (New) and your selected fields.",
    };
  },

  async generateDiagnosticReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      api_keys_configured: {
        groq: !!process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("your_"),
        google: !!process.env.GOOGLE_MAPS_SERVER_API_KEY && !process.env.GOOGLE_MAPS_SERVER_API_KEY.includes("your_"),
        google_timezone: !!process.env.GOOGLE_MAPS_SERVER_API_KEY && !process.env.GOOGLE_MAPS_SERVER_API_KEY.includes("your_"),
        google_routes: !!process.env.GOOGLE_MAPS_SERVER_API_KEY && !process.env.GOOGLE_MAPS_SERVER_API_KEY.includes("your_"),
        openweather: !!process.env.OPEN_WEATHER_KEY && !process.env.OPEN_WEATHER_KEY.includes("your_"),
        google_places: !!googlePlacesKey() && !googlePlacesKey().includes("your_"),
        news: !!process.env.NEWS_API_KEY && !process.env.NEWS_API_KEY.includes("your_"),
      },
      connectivity: await this.testAllAPIs(),
      performance: await this.performanceTest(),
      quota: await this.testGooglePlacesQuota(),
    };

    return report;
  },

  async quickHealthCheck() {
    const critical = await Promise.allSettled([
      this.testGroqConnectivity(),
      this.testGooglePlaces(),
      this.testOpenWeather(),
    ]);

    const results = critical.map((result) => result.status === "fulfilled" && result.value.success);

    return {
      healthy: results.every(Boolean),
      services: {
        groq: results[0],
        google_places: results[1],
        weather: results[2],
      },
      timestamp: new Date().toISOString(),
    };
  },
};

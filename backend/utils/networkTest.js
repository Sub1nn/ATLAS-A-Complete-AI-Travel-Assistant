// utils/networkTest.js - Network connectivity testing with Google Places API
import axios from "axios";

export const networkTest = {
  async testGroqConnectivity() {
    try {
      console.log("🔍 Testing Groq API connectivity...");

      const response = await axios.get(
        "https://api.groq.com/openai/v1/models",
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          timeout: 10000,
        }
      );

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
    const results = {
      groq: await this.testGroqConnectivity(),
      google: await this.testGoogleMaps(),
      openweather: await this.testOpenWeather(),
      googleplaces: await this.testGooglePlaces(), // Changed from yelp
      news: await this.testNewsAPI(),
    };

    console.log("📊 API Connectivity Results:", results);
    return results;
  },

  async testGoogleMaps() {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${process.env.GOOGLE_API_KEY}`,
        { timeout: 5000 }
      );
      return { success: true, status: response.status };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  },

  async testOpenWeather() {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=0&lon=0&appid=${process.env.OPEN_WEATHER_KEY}`,
        { timeout: 5000 }
      );
      return { success: true, status: response.status };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  },

  async testGooglePlaces() {
    try {
      // Test Google Places API with a valid location (New York City)
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=40.7128,-74.0060&radius=1000&type=restaurant&key=${process.env.GOOGLE_PLACES_API_KEY}`,
        {
          timeout: 8000,
        }
      );

      // Check if the response has results
      const hasResults =
        response.data.results && response.data.results.length > 0;

      return {
        success: true,
        status: response.status,
        results_count: response.data.results?.length || 0,
        api_status: response.data.status,
      };
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
      const response = await axios.get(
        `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${process.env.NEWS_API_KEY}`,
        { timeout: 5000 }
      );
      return { success: true, status: response.status };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  },

  // Enhanced Google Places testing with detailed diagnostics
  async testGooglePlacesDetailed() {
    try {
      console.log("🔍 Testing Google Places API with detailed diagnostics...");

      // Test restaurant search
      const restaurantTest = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=40.7128,-74.0060&radius=2000&type=restaurant&key=${process.env.GOOGLE_PLACES_API_KEY}`,
        { timeout: 8000 }
      );

      console.log(
        `✅ Google Places restaurant search: Found ${
          restaurantTest.data.results?.length || 0
        } results`
      );

      // Test accommodation search
      const hotelTest = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=40.7128,-74.0060&radius=5000&type=lodging&key=${process.env.GOOGLE_PLACES_API_KEY}`,
        { timeout: 8000 }
      );

      console.log(
        `✅ Google Places hotel search: Found ${
          hotelTest.data.results?.length || 0
        } results`
      );

      // Test tourist attraction search
      const attractionTest = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=40.7128,-74.0060&radius=5000&type=tourist_attraction&key=${process.env.GOOGLE_PLACES_API_KEY}`,
        { timeout: 8000 }
      );

      console.log(
        `✅ Google Places attraction search: Found ${
          attractionTest.data.results?.length || 0
        } results`
      );

      return {
        success: true,
        status: hotelTest.status,
        restaurant_results: restaurantTest.data.results?.length || 0,
        hotel_results: hotelTest.data.results?.length || 0,
        attraction_results: attractionTest.data.results?.length || 0,
        api_status: restaurantTest.data.status,
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

  // Test API rate limits and response times
  async performanceTest() {
    console.log("🚀 Running API performance tests...");
    const results = {};

    const apis = [
      { name: "groq", test: () => this.testGroqConnectivity() },
      { name: "openweather", test: () => this.testOpenWeather() },
      { name: "googleplaces", test: () => this.testGooglePlaces() },
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
          performance:
            responseTime < 1000
              ? "fast"
              : responseTime < 3000
              ? "moderate"
              : "slow",
        };

        console.log(
          `📊 ${api.name.toUpperCase()}: ${responseTime}ms (${
            results[api.name].performance
          })`
        );
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

  // Test Google Places quota usage
  async testGooglePlacesQuota() {
    try {
      console.log("💰 Testing Google Places API quota usage...");

      const startTime = Date.now();

      // Make a few test requests to estimate quota usage
      const testRequests = [
        axios.get(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=40.7128,-74.0060&radius=1000&type=restaurant&key=${process.env.GOOGLE_PLACES_API_KEY}`
        ),
        axios.get(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=51.5074,-0.1278&radius=1000&type=lodging&key=${process.env.GOOGLE_PLACES_API_KEY}`
        ),
        axios.get(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=48.8566,2.3522&radius=1000&type=tourist_attraction&key=${process.env.GOOGLE_PLACES_API_KEY}`
        ),
      ];

      const results = await Promise.allSettled(testRequests);
      const successCount = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const totalTime = Date.now() - startTime;

      console.log(
        `✅ Google Places quota test: ${successCount}/3 requests succeeded in ${totalTime}ms`
      );

      // Estimate monthly usage based on response time and success rate
      const avgResponseTime = totalTime / 3;
      const successRate = successCount / 3;

      return {
        success: true,
        successful_requests: successCount,
        total_requests: 3,
        success_rate: Math.round(successRate * 100) + "%",
        average_response_time: Math.round(avgResponseTime) + "ms",
        estimated_monthly_cost: this.estimateMonthlyCost(1000), // Estimate for 1000 monthly requests
        quota_status: "healthy",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        quota_status: "unknown",
      };
    }
  },

  // Estimate Google Places API monthly cost
  estimateMonthlyCost(monthlyRequests) {
    // Google Places Nearby Search costs $32 per 1,000 requests
    const costPer1000 = 32;
    const estimatedCost = (monthlyRequests / 1000) * costPer1000;

    // Google provides $200 monthly credit
    const freeCredit = 200;
    const netCost = Math.max(0, estimatedCost - freeCredit);

    return {
      gross_cost: `$${estimatedCost.toFixed(2)}`,
      free_credit: `$${freeCredit}`,
      net_cost: `$${netCost.toFixed(2)}`,
      requests_covered_free: Math.floor((freeCredit / costPer1000) * 1000),
    };
  },

  // Comprehensive network diagnostic
  async fullDiagnostic() {
    console.log("🔧 Running comprehensive network diagnostic...");

    const basic = await this.testAllAPIs();
    const detailed = await this.testGooglePlacesDetailed();
    const performance = await this.performanceTest();
    const quota = await this.testGooglePlacesQuota();

    return {
      basic,
      google_places_detailed: detailed,
      performance,
      quota_analysis: quota,
      summary: {
        total_apis: Object.keys(basic).length,
        working_apis: Object.values(basic).filter((r) => r.success).length,
        avg_response_time: Object.values(performance)
          .filter((r) => r.responseTime && !r.responseTime.includes("timeout"))
          .reduce((acc, curr, _, arr) => {
            const time = parseInt(curr.responseTime);
            return acc + time / arr.length;
          }, 0),
        google_places_status: basic.googleplaces?.success
          ? "operational"
          : "degraded",
        estimated_monthly_usage: quota.estimated_monthly_cost || "unknown",
      },
    };
  },
};

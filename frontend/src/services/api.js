import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    console.log(
      `🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`
    );
    return config;
  },
  (error) => {
    console.error("❌ API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(
      "❌ API Response Error:",
      error.response?.data || error.message
    );

    // Handle different types of errors
    if (error.response?.status === 429) {
      throw new Error(
        "Too many requests. Please wait a moment before trying again."
      );
    } else if (error.response?.status >= 500) {
      throw new Error("Server error. Please try again later.");
    } else if (error.response?.status === 404) {
      throw new Error(
        "API endpoint not found. Please check if the backend server is running correctly."
      );
    } else if (error.code === "ECONNABORTED") {
      throw new Error(
        "Request timeout. Please check your connection and try again."
      );
    } else if (error.code === "ECONNREFUSED") {
      throw new Error(
        "Cannot connect to server. Please make sure the backend server is running on the correct port."
      );
    } else if (error.code === "ENOTFOUND") {
      throw new Error("Network error. Please check your internet connection.");
    } else if (!error.response) {
      throw new Error(
        "Network error. Please check your internet connection and server status."
      );
    }

    return Promise.reject(error);
  }
);

export const chatAPI = {
  async sendMessage(message, userId = "user_123") {
    try {
      const response = await apiClient.post("/chat", {
        message,
        userId,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to send message"
      );
    }
  },

  async resetContext(userId = "user_123") {
    try {
      const response = await apiClient.post("/reset-context", {
        userId,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to reset context"
      );
    }
  },

  async getContext(userId = "user_123") {
    try {
      const response = await apiClient.get(`/context/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          "Failed to get context"
      );
    }
  },

  async healthCheck() {
    try {
      const response = await axios.get(
        `${API_BASE_URL.replace("/api", "")}/health`
      );
      return response.data;
    } catch (error) {
      throw new Error("Health check failed");
    }
  },

  async networkTest() {
    try {
      const response = await apiClient.get("/network-test");
      return response.data;
    } catch (error) {
      throw new Error("Network test failed: " + error.message);
    }
  },
};

import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

const clearStoredSession = () => {
  localStorage.removeItem("atlas_token");
  localStorage.removeItem("atlas_user");
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("atlas_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || "Request failed";

    if (status === 401) {
      clearStoredSession();
      window.dispatchEvent(new Event("atlas:session-expired"));
    }

    return Promise.reject(new Error(message));
  }
);

export const authAPI = {
  async signup(payload) {
    const { data } = await apiClient.post("/auth/signup", payload);
    localStorage.setItem("atlas_token", data.token);
    localStorage.setItem("atlas_user", JSON.stringify(data.user));
    return data;
  },
  async login(payload) {
    const { data } = await apiClient.post("/auth/login", payload);
    localStorage.setItem("atlas_token", data.token);
    localStorage.setItem("atlas_user", JSON.stringify(data.user));
    return data;
  },
  async me() {
    const { data } = await apiClient.get("/auth/me");
    localStorage.setItem("atlas_user", JSON.stringify(data.user));
    return data;
  },

  async verifyEmail(token) {
    const { data } = await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    if (data.token) localStorage.setItem("atlas_token", data.token);
    if (data.user) localStorage.setItem("atlas_user", JSON.stringify(data.user));
    return data;
  },
  async resendVerification() {
    const { data } = await apiClient.post("/auth/resend-verification");
    return data;
  },
  async forgotPassword(email) {
    const { data } = await apiClient.post("/auth/forgot-password", { email });
    return data;
  },
  async resetPassword({ token, password }) {
    const { data } = await apiClient.post("/auth/reset-password", { token, password });
    return data;
  },
  async updatePreferences(payload) {
    const { data } = await apiClient.patch("/auth/preferences", payload);
    if (data.user) localStorage.setItem("atlas_user", JSON.stringify(data.user));
    return data;
  },
  logout() {
    clearStoredSession();
  },
};

export const conversationAPI = {
  async list() {
    const { data } = await apiClient.get("/conversations");
    return data.conversations || [];
  },
  async create(title) {
    const { data } = await apiClient.post("/conversations", { title });
    return data.conversation;
  },
  async get(id) {
    const { data } = await apiClient.get(`/conversations/${id}`);
    return data.conversation;
  },
  async remove(id) {
    const { data } = await apiClient.delete(`/conversations/${id}`);
    return data;
  },
  async clearAll() {
    const { data } = await apiClient.delete("/conversations");
    return data;
  },
};

export const documentAPI = {
  async list() {
    const { data } = await apiClient.get("/documents");
    return data.documents || [];
  },
  async upload(file) {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 90000,
    });
    return data.document;
  },
  async remove(id) {
    const { data } = await apiClient.delete(`/documents/${id}`);
    return data;
  },
};


export const chatAPI = {
  async sendMessage({ message, conversationId, documentIds = [] }) {
    const { data } = await apiClient.post("/chat", {
      message,
      conversationId,
      documentIds,
    });
    return data;
  },
  async resetContext(conversationId) {
    const { data } = await apiClient.post("/reset-context", { conversationId });
    return data;
  },
  async healthCheck() {
    const base = API_BASE_URL.replace(/\/api\/?$/, "");
    const { data } = await axios.get(`${base}/health`);
    return data;
  },
};

export default apiClient;

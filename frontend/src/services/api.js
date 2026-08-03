import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const CHAT_TIMEOUT_MS = Number(import.meta.env.VITE_CHAT_TIMEOUT_MS || 100000);
const HEALTH_TIMEOUT_MS = Number(import.meta.env.VITE_HEALTH_TIMEOUT_MS || 5000);
let accessToken = null;
let csrfToken = null;
let refreshPromise = null;

// Remove legacy long-lived browser storage from versions released before refresh cookies.
localStorage.removeItem("atlas_token");
localStorage.removeItem("atlas_user");

const clearStoredSession = () => {
  accessToken = null;
  csrfToken = null;
};

const applySession = (data = {}) => {
  accessToken = data.token || null;
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
};

const obtainCsrfToken = async () => {
  const { data } = await axios.get(`${API_BASE_URL}/auth/csrf`, { withCredentials: true, timeout: 10000 });
  csrfToken = data.csrfToken;
  return csrfToken;
};

const performRefresh = async (allowRetry = true) => {
  const csrf = csrfToken || await obtainCsrfToken();
  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
      withCredentials: true,
      timeout: 10000,
      headers: { "X-CSRF-Token": csrf },
    });
    return applySession(data);
  } catch (error) {
    if (allowRetry && error.response?.status === 409 && error.response?.data?.code === "REFRESH_IN_PROGRESS") {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await obtainCsrfToken();
      return performRefresh(false);
    }
    throw error;
  }
};

const refreshSession = () => {
  if (!refreshPromise) refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || "Request failed";

    const original = error.config || {};
    const authPath = String(original.url || "");
    const refreshAllowed = !/\/auth\/(login|signup|refresh|forgot-password|reset-password|verify-email)/.test(authPath);
    if (status === 401 && refreshAllowed && !original._retry) {
      original._retry = true;
      try {
        await refreshSession();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${accessToken}` };
        return apiClient(original);
      } catch {
        clearStoredSession();
        window.dispatchEvent(new Event("atlas:session-expired"));
      }
    }

    const normalizedError = new Error(message);
    normalizedError.requestId = error.response?.data?.requestId || error.response?.headers?.["x-request-id"];
    normalizedError.status = status;
    return Promise.reject(normalizedError);
  }
);

export const authAPI = {
  async config() {
    const { data } = await apiClient.get("/auth/config");
    return data;
  },
  async signup(payload) {
    const { data } = await apiClient.post("/auth/signup", payload);
    return applySession(data);
  },
  async login(payload) {
    const { data } = await apiClient.post("/auth/login", payload);
    return applySession(data);
  },
  async me() {
    const { data } = await apiClient.get("/auth/me");
    return data;
  },

  async restoreSession() {
    return refreshSession();
  },

  async verifyEmail(token) {
    const { data } = await apiClient.post("/auth/verify-email", { token });
    return applySession(data);
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
    return data;
  },
  async acceptPolicies() {
    const { data } = await apiClient.post("/auth/accept-policies", { privacyAccepted: true });
    return data;
  },
  async exportData() {
    return apiClient.get("/auth/data-export", { responseType: "blob", timeout: 60000 });
  },
  async updateRetention(dataRetentionDays) {
    const { data } = await apiClient.patch("/auth/privacy-settings", { dataRetentionDays });
    return data;
  },
  async deleteAccount(password) {
    const { data } = await apiClient.delete("/auth/account", { data: { password }, timeout: 60000 });
    clearStoredSession();
    return data;
  },
  async logout() {
    try {
      const csrf = csrfToken || await obtainCsrfToken();
      await apiClient.post("/auth/logout", {}, { headers: { "X-CSRF-Token": csrf } });
    } finally {
      clearStoredSession();
    }
  },
  clearLocalSession: clearStoredSession,
};

export const conversationAPI = {
  async list() {
    const { data } = await apiClient.get("/conversations");
    return data.conversations || [];
  },
  async listPage({ cursor, limit = 25 } = {}) {
    const { data } = await apiClient.get("/conversations", { params: { cursor, limit } });
    return data;
  },
  async create(title) {
    const { data } = await apiClient.post("/conversations", { title });
    return data.conversation;
  },
  async get(id, { cursor, limit = 100 } = {}) {
    const { data } = await apiClient.get(`/conversations/${id}`, { params: { cursor, limit } });
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
  async retry(id) {
    const { data } = await apiClient.post(`/documents/${id}/retry`);
    return data.document;
  },
};


export const chatAPI = {
  async sendMessage({ message, conversationId, documentIds = [], clientRequestId, signal }) {
    const timeZone = window.Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const localDateParts = new window.Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type) => localDateParts.find((item) => item.type === type)?.value || "";
    const { data } = await apiClient.post("/chat", {
      clientRequestId,
      message,
      conversationId,
      documentIds,
      clientLocalDate: `${part("year")}-${part("month")}-${part("day")}`,
      clientTimeZone: timeZone,
    }, { signal, timeout: CHAT_TIMEOUT_MS });
    return data;
  },
  async resetContext(conversationId) {
    const { data } = await apiClient.post("/reset-context", { conversationId });
    return data;
  },
  async healthCheck({ signal } = {}) {
    const base = API_BASE_URL.replace(/\/api\/?$/, "");
    const { data } = await axios.get(`${base}/health`, { signal, timeout: HEALTH_TIMEOUT_MS });
    return data;
  },
};

export default apiClient;

import axios from "axios";

const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const envApiUrl = import.meta.env.VITE_API_URL?.trim();
const normalizedEnvApiUrl = envApiUrl ? envApiUrl.replace(/\/+$/, "") : "";
const envBaseUrl = normalizedEnvApiUrl
  ? (normalizedEnvApiUrl.endsWith("/api") ? normalizedEnvApiUrl : `${normalizedEnvApiUrl}/api`)
  : "";
const apiBaseUrl = envBaseUrl || (isLocalHost ? "/api" : "https://ragbased-chat-bot.onrender.com/api");

const api = axios.create({
  baseURL: apiBaseUrl
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

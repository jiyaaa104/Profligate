import axios from "axios";

/**
 * Shared Axios instance for Profligate API
 * - baseURL: "/api/v1" is same-origin. In dev, Vite proxies /api to
 *   localhost:8000 (vite.config.js); in production, Vercel rewrites /api to
 *   the Render backend (vercel.json). Because the browser only ever talks to
 *   one origin, the HttpOnly auth cookies are first-party and are sent on
 *   every request (cross-site cookies get blocked by Brave/Safari/sameSite).
 * - withCredentials: true ensures HttpOnly cookies (accessToken, refreshToken)
 *   are transmitted across requests automatically.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth endpoints that must never trigger an automatic token refresh.
const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/logout",
];

// One shared refresh request, so parallel 401s don't each rotate the token
// (the backend deletes a refresh token once it has been used).
let refreshPromise = null;

const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const endSession = () => {
  localStorage.removeItem("profligate_user");
  if (!["/login", "/register", "/verify-email"].includes(window.location.pathname)) {
    window.location.assign("/login");
  }
};

// Response interceptor: refresh expired access tokens once, and format errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthPath = NO_REFRESH_PATHS.some((p) => original?.url?.startsWith(p));

    if (error.response?.status === 401 && original && !original._retry && !isAuthPath) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        endSession();
      }
    }

    // Extract standardized message from backend ApiError format
    const message =
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred. Please try again.";

    // Attach extracted message to error object for easy consumption in UI
    error.friendlyMessage = message;
    return Promise.reject(error);
  }
);

export default api;

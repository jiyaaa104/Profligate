import axios from "axios";

/**
 * Shared Axios instance for Profligate API
 * - baseURL: points to the Express API base
 * - withCredentials: true ensures HttpOnly cookies (accessToken, refreshToken)
 *   are transmitted across requests automatically.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor to format errors consistently
api.interceptors.response.use(
  (response) => response,
  (error) => {
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


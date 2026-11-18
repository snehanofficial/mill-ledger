import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// OWASP: Handle session expiration and 401 Unauthorized across active API requests
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      // Ignore passive session verification requests to avoid triggering unnecessary reload loops
      if (!url.includes("/me") && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("millledger:unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);

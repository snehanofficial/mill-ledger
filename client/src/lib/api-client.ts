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

/**
 * Extracts a human-readable error message from API errors across Axios response
 * structures or standard Error instances.
 */
export function extractErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred",
): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as {
    response?: { data?: { message?: unknown } };
    message?: unknown;
  };
  if (
    typeof e.response?.data?.message === "string" &&
    e.response.data.message.trim().length > 0
  ) {
    return e.response.data.message;
  }
  if (typeof e.message === "string" && e.message.trim().length > 0) {
    return e.message;
  }
  return fallback;
}

/**
 * Extracts correlation request ID from API errors across Axios response structures,
 * headers, or standard error objects.
 */
export function extractRequestId(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as {
    response?: {
      data?: { requestId?: string };
      headers?: Record<string, string | undefined>;
    };
    requestId?: string;
  };
  return (
    e.response?.data?.requestId ||
    e.response?.headers?.["x-request-id"] ||
    e.requestId
  );
}


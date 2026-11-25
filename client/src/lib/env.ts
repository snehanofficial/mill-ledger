/**
 * Normalizes a required URL environment variable by trimming whitespace and
 * stripping trailing slashes, throwing an explicit error if missing.
 */
export function requireEnvUrl(raw: string | undefined, name: string): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.replace(/\/+$/, "");
}

/** Base URL of the backend API server (without trailing slash). */
export const BACKEND_URL = requireEnvUrl(
  import.meta.env.VITE_BACKEND_URL,
  "VITE_BACKEND_URL",
);

/**
 * Uniform API Error Response envelope conforming to RFC 7807 and OWASP API8:2023.
 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  details?: unknown;
  requestId?: string;
}

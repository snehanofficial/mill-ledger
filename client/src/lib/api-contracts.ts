/**
 * Explicit runtime contract validation at the API boundary.
 * Ensures malformed, null, or unexpectedly shaped server payloads fail loudly
 * with actionable diagnostics rather than crashing UI `.map()` calls or
 * silently masquerading as empty datasets.
 */

export class ApiContractError extends Error {
  public readonly endpoint: string;
  public readonly expected: string;
  public readonly actualType: string;
  public readonly route: string | undefined;

  constructor(params: {
    endpoint: string;
    expected: string;
    actualType: string;
    message?: string;
  }) {
    const route =
      typeof window !== "undefined" ? window.location.pathname : undefined;
    const msg =
      params.message ??
      `Invalid response from ${params.endpoint}: expected ${params.expected}, received ${params.actualType}.`;
    super(msg);
    this.name = "ApiContractError";
    this.endpoint = params.endpoint;
    this.expected = params.expected;
    this.actualType = params.actualType;
    this.route = route;

    console.error("[ApiContractError]", {
      endpoint: this.endpoint,
      expected: this.expected,
      actualType: this.actualType,
      route: this.route,
      timestamp: new Date().toISOString(),
    });
  }
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates that an API response payload is an object containing an array at `field`.
 */
export function assertCollectionResponse<
  T extends object = Record<string, unknown>,
>(payload: unknown, field: string, endpoint: string): T {
  if (!isPlainRecord(payload)) {
    throw new ApiContractError({
      endpoint,
      expected: `object with array "${field}"`,
      actualType: describeValue(payload),
    });
  }

  const collection = payload[field];
  if (!Array.isArray(collection)) {
    throw new ApiContractError({
      endpoint,
      expected: `array at "${field}"`,
      actualType: describeValue(collection),
    });
  }

  return payload as T;
}

/**
 * Unwraps an entity response that may be returned directly or under `{ [wrapperKey]: entity }`,
 * and validates that all `requiredArrayFields` are actual arrays.
 */
export function assertEntityResponse<
  T extends object = Record<string, unknown>,
>(
  payload: unknown,
  wrapperKey: string | null,
  requiredArrayFields: string[],
  endpoint: string,
): T {
  if (!isPlainRecord(payload)) {
    throw new ApiContractError({
      endpoint,
      expected: wrapperKey ? `object or { ${wrapperKey} }` : "object",
      actualType: describeValue(payload),
    });
  }

  const entity =
    wrapperKey && wrapperKey in payload ? payload[wrapperKey] : payload;

  if (!isPlainRecord(entity)) {
    throw new ApiContractError({
      endpoint,
      expected: `object at "${wrapperKey ?? "root"}"`,
      actualType: describeValue(entity),
    });
  }

  for (const field of requiredArrayFields) {
    if (!Array.isArray(entity[field])) {
      throw new ApiContractError({
        endpoint,
        expected: `array at "${field}"`,
        actualType: describeValue(entity[field]),
      });
    }
  }

  return entity as T;
}

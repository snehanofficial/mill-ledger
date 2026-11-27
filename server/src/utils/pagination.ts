import type { PaginationMeta } from "@mill-ledger/shared";

export interface PaginationParams {
  limit: number;
  offset: number;
  page: number;
}

export interface PaginationDefaults {
  limit?: number;
  maxLimit?: number;
}

/**
 * Parses limit, offset, and page from request query parameters with bounded limits.
 * Supports both offset-based (?limit=20&offset=40) and page-based (?page=3&limit=20).
 */
export function parsePaginationQuery(
  query: Record<string, unknown>,
  defaults: PaginationDefaults = {},
): PaginationParams {
  const defaultLimit = defaults.limit ?? 50;
  const maxLimit = defaults.maxLimit ?? 100;

  const rawLimit = query.limit !== undefined ? Number(query.limit) : NaN;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit;

  const rawOffset = query.offset !== undefined ? Number(query.offset) : NaN;
  const rawPage = query.page !== undefined ? Number(query.page) : NaN;

  let offset = 0;
  if (Number.isFinite(rawOffset) && rawOffset >= 0) {
    offset = Math.floor(rawOffset);
  } else if (Number.isFinite(rawPage) && rawPage >= 1) {
    offset = (Math.floor(rawPage) - 1) * limit;
  }

  const page = Math.floor(offset / limit) + 1;
  return { limit, offset, page };
}

/**
 * Normalizes service-level pagination options so services can be called
 * directly from tests or controllers.
 */
export function normalizePaginationOptions(
  options?: { limit?: number; offset?: number; page?: number },
  defaults: PaginationDefaults = {},
): PaginationParams {
  const defaultLimit = defaults.limit ?? 50;
  const maxLimit = defaults.maxLimit ?? 100;

  const limit =
    options?.limit !== undefined && Number.isFinite(options.limit) && options.limit >= 1
      ? Math.min(Math.floor(options.limit), maxLimit)
      : defaultLimit;

  let offset = 0;
  if (
    options?.offset !== undefined &&
    Number.isFinite(options.offset) &&
    options.offset >= 0
  ) {
    offset = Math.floor(options.offset);
  } else if (
    options?.page !== undefined &&
    Number.isFinite(options.page) &&
    options.page >= 1
  ) {
    offset = (Math.floor(options.page) - 1) * limit;
  }

  const page = Math.floor(offset / limit) + 1;
  return { limit, offset, page };
}

/**
 * Builds a consistent PaginationMeta envelope for list responses.
 */
export function buildPaginationMeta(
  limit: number,
  offset: number,
  count: number,
  total: number,
): PaginationMeta {
  const safeLimit = Math.max(1, limit);
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const page = Math.floor(offset / safeLimit) + 1;
  return {
    limit: safeLimit,
    offset,
    count,
    total: safeTotal,
    page,
    totalPages,
  };
}

/**
 * Slices an in-memory array using normalized pagination parameters and returns
 * both the sliced items and PaginationMeta.
 */
export function paginateArray<T>(
  items: T[],
  options?: { limit?: number; offset?: number; page?: number },
  defaults: PaginationDefaults = {},
): { items: T[]; pagination: PaginationMeta } {
  const { limit, offset } = normalizePaginationOptions(options, defaults);
  const sliced = items.slice(offset, offset + limit);
  return {
    items: sliced,
    pagination: buildPaginationMeta(limit, offset, sliced.length, items.length),
  };
}

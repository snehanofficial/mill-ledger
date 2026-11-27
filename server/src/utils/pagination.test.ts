import { describe, it, expect } from "vitest";
import {
  buildPaginationMeta,
  normalizePaginationOptions,
  paginateArray,
  parsePaginationQuery,
} from "./pagination.js";

describe("pagination utilities", () => {
  it("parses limit and offset with bounded maxLimit", () => {
    expect(parsePaginationQuery({})).toEqual({ limit: 50, offset: 0, page: 1 });
    expect(parsePaginationQuery({ limit: "20", offset: "40" })).toEqual({
      limit: 20,
      offset: 40,
      page: 3,
    });
    expect(parsePaginationQuery({ limit: "500", page: "2" })).toEqual({
      limit: 100,
      offset: 100,
      page: 2,
    });
    expect(parsePaginationQuery({ limit: "-5", offset: "-10" })).toEqual({
      limit: 50,
      offset: 0,
      page: 1,
    });
  });

  it("normalizes service options for page and offset", () => {
    expect(normalizePaginationOptions({ page: 3, limit: 15 })).toEqual({
      limit: 15,
      offset: 30,
      page: 3,
    });
    expect(
      normalizePaginationOptions({ limit: 10, offset: 20, page: 1 }),
    ).toEqual({
      limit: 10,
      offset: 20,
      page: 3,
    });
  });

  it("builds consistent PaginationMeta", () => {
    expect(buildPaginationMeta(20, 40, 12, 52)).toEqual({
      limit: 20,
      offset: 40,
      count: 12,
      total: 52,
      page: 3,
      totalPages: 3,
    });
    expect(buildPaginationMeta(20, 0, 0, 0)).toEqual({
      limit: 20,
      offset: 0,
      count: 0,
      total: 0,
      page: 1,
      totalPages: 1,
    });
  });

  it("paginates arrays accurately", () => {
    const data = Array.from({ length: 25 }, (_, i) => i + 1);
    const page2 = paginateArray(data, { limit: 10, page: 2 });
    expect(page2.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(page2.pagination).toEqual({
      limit: 10,
      offset: 10,
      count: 10,
      total: 25,
      page: 2,
      totalPages: 3,
    });
  });
});

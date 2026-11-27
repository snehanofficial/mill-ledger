import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export interface UsePaginationOptions {
  defaultPageSize?: number;
  /** Optional prefix for URL params when multiple paginated lists share a page (e.g. "dn" -> "dnPage", "dnLimit") */
  prefix?: string;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  offset: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  resetPage: () => void;
}

export function usePagination(
  options: UsePaginationOptions = {},
): UsePaginationReturn {
  const defaultPageSize = options.defaultPageSize ?? 20;
  const pageKey = options.prefix ? `${options.prefix}Page` : "page";
  const limitKey = options.prefix ? `${options.prefix}Limit` : "limit";

  const [searchParams, setSearchParams] = useSearchParams();

  const rawLimit = searchParams.get(limitKey);
  const parsedLimit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : NaN;
  const pageSize =
    Number.isFinite(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100
      ? parsedLimit
      : defaultPageSize;

  const rawPage = searchParams.get(pageKey);
  const parsedPage = rawPage !== null ? Number.parseInt(rawPage, 10) : NaN;
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const offset = (page - 1) * pageSize;

  const setPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.floor(nextPage));
      if (clamped === page) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (clamped === 1) {
            next.delete(pageKey);
          } else {
            next.set(pageKey, String(clamped));
          }
          return next;
        },
        { replace: true },
      );
    },
    [page, pageKey, setSearchParams],
  );

  const setPageSize = useCallback(
    (nextSize: number) => {
      const clamped = Math.min(100, Math.max(1, Math.floor(nextSize)));
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (clamped === defaultPageSize) {
            next.delete(limitKey);
          } else {
            next.set(limitKey, String(clamped));
          }
          next.delete(pageKey);
          return next;
        },
        { replace: true },
      );
    },
    [defaultPageSize, limitKey, pageKey, setSearchParams],
  );

  const resetPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  return {
    page,
    pageSize,
    offset,
    setPage,
    setPageSize,
    resetPage,
  };
}

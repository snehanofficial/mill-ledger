import { useCallback } from "react";
import { useUrlState } from "@/hooks/use-url-state";

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

  const [rawPage, setRawPage] = useUrlState(pageKey, "1");
  const [rawLimit, setRawLimit] = useUrlState(
    limitKey,
    String(defaultPageSize),
  );

  const parsedLimit = Number.parseInt(rawLimit, 10);
  const pageSize =
    Number.isFinite(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100
      ? parsedLimit
      : defaultPageSize;

  const parsedPage = Number.parseInt(rawPage, 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const offset = (page - 1) * pageSize;

  const setPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.floor(nextPage));
      setRawPage(String(clamped));
    },
    [setRawPage],
  );

  const setPageSize = useCallback(
    (nextSize: number) => {
      const clamped = Math.min(100, Math.max(1, Math.floor(nextSize)));
      setRawLimit(String(clamped));
      setRawPage("1");
    },
    [setRawLimit, setRawPage],
  );

  const resetPage = useCallback(() => {
    setRawPage("1");
  }, [setRawPage]);

  return {
    page,
    pageSize,
    offset,
    setPage,
    setPageSize,
    resetPage,
  };
}

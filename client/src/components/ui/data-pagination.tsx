import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { PaginationMeta } from "@mill-ledger/shared";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DataPaginationProps {
  pagination?: Partial<PaginationMeta> | null;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isFetching?: boolean;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

function getVisiblePages(
  current: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  if (start > 2) {
    pages.push("ellipsis");
  }
  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }
  if (end < totalPages - 1) {
    pages.push("ellipsis");
  }
  pages.push(totalPages);
  return pages;
}

const controlButtonBase =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border text-body-medium font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

export function DataPagination({
  pagination,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isFetching = false,
  pageSizeOptions = [10, 20, 50, 100],
  itemLabel = "records",
  className,
}: DataPaginationProps) {
  const total = pagination?.total ?? 0;
  if (total <= 0) {
    return null;
  }

  const effectiveLimit = pagination?.limit ?? pageSize;
  const totalPages = Math.max(
    1,
    pagination?.totalPages ?? Math.ceil(total / effectiveLimit),
  );
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = (currentPage - 1) * effectiveLimit + 1;
  const rangeEnd = Math.min(currentPage * effectiveLimit, total);
  const pages = getVisiblePages(currentPage, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          Showing{" "}
          <span className="font-semibold text-foreground">{rangeStart}</span>
          {"–"}
          <span className="font-semibold text-foreground">
            {rangeEnd}
          </span> of{" "}
          <span className="font-semibold text-foreground">{total}</span>{" "}
          {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span id="rows-per-page-label">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
              disabled={isFetching}
            >
              <SelectTrigger
                aria-labelledby="rows-per-page-label"
                className="h-9 w-[74px] text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent className="flex-wrap">
            <PaginationItem>
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || isFetching}
                aria-label="Go to previous page"
                className={cn(
                  controlButtonBase,
                  "gap-1 border-control bg-background px-3 text-foreground hover:bg-accent",
                )}
              >
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Previous</span>
              </button>
            </PaginationItem>

            {pages.map((p, idx) =>
              p === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <button
                    type="button"
                    onClick={() => onPageChange(p)}
                    disabled={isFetching}
                    aria-label={`Go to page ${p}`}
                    aria-current={p === currentPage ? "page" : undefined}
                    className={cn(
                      controlButtonBase,
                      "px-3 tabular-nums",
                      p === currentPage
                        ? "border-primary bg-selection text-primary"
                        : "border-control bg-background text-foreground hover:bg-accent",
                    )}
                  >
                    {p}
                  </button>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <button
                type="button"
                onClick={() =>
                  onPageChange(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage >= totalPages || isFetching}
                aria-label="Go to next page"
                className={cn(
                  controlButtonBase,
                  "gap-1 border-control bg-background px-3 text-foreground hover:bg-accent",
                )}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

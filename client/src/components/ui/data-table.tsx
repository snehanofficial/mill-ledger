import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  Columns3Icon,
  DownloadIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableColumnMeta<TData = unknown> {
  label?: string;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
  exportValue?: (row: TData) => string | number | boolean | null | undefined;
}

export interface DataTableBulkAction<TData> {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  disabled?: boolean | ((selectedRows: TData[]) => boolean);
  hidden?: (selectedRows: TData[]) => boolean;
  onClick: (selectedRows: TData[], clearSelection: () => void) => void | Promise<void>;
}

export interface DataTableProps<TData> {
  /** Unique identifier used to persist column visibility in localStorage */
  tableId: string;
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId?: (row: TData, index: number) => string;
  ariaLabel?: string;
  enableRowSelection?: boolean;
  enableColumnVisibility?: boolean;
  enableCsvExport?: boolean;
  csvFilename?: string;
  bulkActions?: DataTableBulkAction<TData>[];
  defaultColumnVisibility?: VisibilityState;
  defaultSorting?: SortingState;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
  emptyMessage?: string;
  className?: string;
}

function readStoredVisibility(
  storageKey: string,
  fallback: VisibilityState,
): VisibilityState {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...fallback, ...parsed };
    }
  } catch {
    // Ignore malformed localStorage entries
  }
  return fallback;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((r) => r.map(escapeCsvCell).join(",")),
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  align = "left",
  className,
}: {
  column: Column<TData, TValue>;
  title: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  if (!column.getCanSort()) {
    return (
      <div
        className={cn(
          "flex items-center gap-1",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
          className,
        )}
      >
        {title}
      </div>
    );
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-small px-1.5 py-1 -mx-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        align === "right" && "flex-row-reverse",
        align === "center" && "justify-center",
        sorted && "text-foreground",
        className,
      )}
    >
      <span>{title}</span>
      {sorted === "asc" ? (
        <ArrowUpIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <ArrowUpDownIcon
          className="size-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function DataTable<TData>({
  tableId,
  data,
  columns,
  getRowId,
  ariaLabel,
  enableRowSelection = true,
  enableColumnVisibility = true,
  enableCsvExport = true,
  csvFilename,
  bulkActions = [],
  defaultColumnVisibility = {},
  defaultSorting = [],
  toolbarLeft,
  toolbarRight,
  onRowClick,
  rowClassName,
  emptyMessage = "No matching records.",
  className,
}: DataTableProps<TData>) {
  const storageKey = `mill-ledger:table-cols:${tableId}`;
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    () => readStoredVisibility(storageKey, defaultColumnVisibility),
  );

  React.useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch {
      // Ignore storage quota errors
    }
  }, [storageKey, columnVisibility]);

  const tableColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enableRowSelection) return columns;

    const selectCol: ColumnDef<TData, unknown> = {
      id: "__select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => {
        const isAllSelected = table.getIsAllPageRowsSelected();
        const isSomeSelected = table.getIsSomePageRowsSelected();
        return (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all rows on this page"
            />
          </div>
        );
      },
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select row ${row.id}`}
          />
        </div>
      ),
      meta: {
        label: "Select",
        headerClassName: "w-10 px-2.5",
        cellClassName: "w-10 px-2.5",
      } satisfies DataTableColumnMeta<TData>,
    };

    return [selectCol, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((r) => r.original);
  const selectedCount = selectedRows.length;
  const clearSelection = React.useCallback(() => setRowSelection({}), []);

  const hideableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide());
  const hiddenCount = hideableColumns.filter((col) => !col.getIsVisible()).length;

  const handleExportSelectedCsv = React.useCallback(() => {
    const exportCols = table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== "__select" && col.id !== "actions");

    const rowsToExport =
      selectedRows.length > 0
        ? table.getSelectedRowModel().rows
        : table.getRowModel().rows;

    const headers = exportCols.map((col) => {
      const meta = col.columnDef.meta as DataTableColumnMeta<TData> | undefined;
      if (meta?.label) return meta.label;
      if (typeof col.columnDef.header === "string") return col.columnDef.header;
      return col.id;
    });

    const csvRows = rowsToExport.map((row) =>
      exportCols.map((col) => {
        const meta = col.columnDef.meta as DataTableColumnMeta<TData> | undefined;
        if (meta?.exportValue) {
          return String(meta.exportValue(row.original) ?? "");
        }
        const val = row.getValue(col.id);
        return val === null || val === undefined ? "" : String(val);
      }),
    );

    downloadCsv(csvFilename || tableId, headers, csvRows);
  }, [csvFilename, selectedRows.length, table, tableId]);

  const showToolbar =
    Boolean(toolbarLeft) ||
    Boolean(toolbarRight) ||
    enableRowSelection ||
    (enableColumnVisibility && hideableColumns.length > 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showToolbar && (
        <div
          role={selectedCount > 0 ? "region" : undefined}
          aria-label={selectedCount > 0 ? "Bulk actions" : undefined}
          className={cn(
            "flex min-h-[46px] flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1 transition-colors",
            selectedCount > 0
              ? "border-primary/30 bg-selection/70"
              : "border-transparent bg-transparent px-0",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            {selectedCount > 0 ? (
              <>
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  {selectedCount} {selectedCount === 1 ? "row" : "rows"} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <XIcon data-icon="inline-start" aria-hidden="true" />
                  Clear
                </Button>
                {bulkActions
                  .filter((action) => !action.hidden?.(selectedRows))
                  .map((action) => {
                    const Icon = action.icon;
                    const isDisabled =
                      typeof action.disabled === "function"
                        ? action.disabled(selectedRows)
                        : action.disabled;
                    return (
                      <Button
                        key={action.id}
                        variant={action.variant ?? "outline"}
                        size="sm"
                        disabled={isDisabled}
                        onClick={() => action.onClick(selectedRows, clearSelection)}
                        className="h-9 text-xs"
                      >
                        {Icon && (
                          <Icon data-icon="inline-start" aria-hidden={true} />
                        )}
                        {action.label}
                      </Button>
                    );
                  })}
                {enableCsvExport && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportSelectedCsv}
                    className="h-9 text-xs"
                  >
                    <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                    Export CSV ({selectedCount})
                  </Button>
                )}
              </>
            ) : (
              toolbarLeft
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toolbarRight}
            {enableColumnVisibility && hideableColumns.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                    aria-label="Customize table columns"
                  >
                    <Columns3Icon data-icon="inline-start" aria-hidden="true" />
                    <span>Columns</span>
                    {hiddenCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                        {hideableColumns.length - hiddenCount}/{hideableColumns.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {hideableColumns.map((column) => {
                      const meta = column.columnDef.meta as
                        | DataTableColumnMeta<TData>
                        | undefined;
                      const label =
                        meta?.label ||
                        (typeof column.columnDef.header === "string"
                          ? column.columnDef.header
                          : column.id);
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                          onSelect={(e) => e.preventDefault()}
                          className="min-h-9 text-xs"
                        >
                          {label}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuGroup>
                  {hiddenCount > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onSelect={() => setColumnVisibility(defaultColumnVisibility)}
                          className="min-h-9 text-xs text-muted-foreground"
                        >
                          <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                          Reset columns
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      <Table aria-label={ariaLabel}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as
                  | DataTableColumnMeta<TData>
                  | undefined;
                const sorted = header.column.getIsSorted();
                const ariaSort = header.column.getCanSort()
                  ? sorted === "asc"
                    ? "ascending"
                    : sorted === "desc"
                      ? "descending"
                      : "none"
                  : undefined;

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort}
                    className={cn(
                      meta?.align === "right" && "text-right",
                      meta?.align === "center" && "text-center",
                      meta?.headerClassName,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row.original),
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | DataTableColumnMeta<TData>
                    | undefined;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        meta?.align === "right" && "text-right",
                        meta?.align === "center" && "text-center",
                        meta?.cellClassName,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getVisibleLeafColumns().length}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

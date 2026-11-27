import { useState } from "react";
import {
  DownloadIcon,
  RefreshCwIcon,
  FileTextIcon,
  TableIcon,
  FileSpreadsheetIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadExportFromApi } from "@/lib/export-download";

export interface ExportMenuProps {
  entity: string;
  label?: string;
  queryParams?: Record<string, string | undefined>;
  formats?: Array<"pdf" | "xlsx" | "csv">;
  size?: "sm" | "default";
}

export function ExportMenu({
  entity,
  label = "Export",
  queryParams,
  formats = ["pdf", "xlsx", "csv"],
  size = "sm",
}: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "pdf" | "xlsx" | "csv") => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const qs = new URLSearchParams();
      qs.set("format", format);
      if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
          if (v !== undefined && v !== "" && v !== "ALL") {
            qs.set(k, v);
          }
        }
      }
      const filename = await downloadExportFromApi({
        url: `/exports/${entity}?${qs.toString()}`,
        extension: format,
        fallbackModule: entity,
      });
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={isExporting}
          className="gap-1.5 cursor-pointer"
        >
          {isExporting ? (
            <RefreshCwIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <DownloadIcon className="size-4" aria-hidden="true" />
          )}
          <span>{isExporting ? "Exporting..." : label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Choose Export Format
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.includes("pdf") && (
          <DropdownMenuItem
            onSelect={() => void handleExport("pdf")}
            className="cursor-pointer gap-2"
          >
            <FileTextIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium">PDF Document</span>
              <span className="text-[11px] text-muted-foreground">
                Formatted, printable document
              </span>
            </div>
          </DropdownMenuItem>
        )}
        {formats.includes("xlsx") && (
          <DropdownMenuItem
            onSelect={() => void handleExport("xlsx")}
            className="cursor-pointer gap-2"
          >
            <FileSpreadsheetIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                Excel Workbook (.xlsx)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Formatted, filterable workbook
              </span>
            </div>
          </DropdownMenuItem>
        )}
        {formats.includes("csv") && (
          <DropdownMenuItem
            onSelect={() => void handleExport("csv")}
            className="cursor-pointer gap-2"
          >
            <TableIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium">CSV Data</span>
              <span className="text-[11px] text-muted-foreground">
                Structured data export
              </span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

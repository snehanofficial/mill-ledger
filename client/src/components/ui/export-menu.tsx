import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useLanguage } from "@/lib/i18n";

export interface ExportMenuProps {
  entity: string;
  label?: string;
  queryParams?: Record<string, string | undefined>;
  formats?: Array<"pdf" | "xlsx" | "csv">;
  size?: "sm" | "default";
}

export function ExportMenu({
  entity,
  label,
  queryParams,
  formats = ["pdf", "xlsx", "csv"],
  size = "sm",
}: ExportMenuProps) {
  const { t } = useTranslation("common");
  const { locale } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);

  const resolvedLabel = label ?? t("exportMenu.export");

  const handleExport = async (format: "pdf" | "xlsx" | "csv") => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const qs = new URLSearchParams();
      qs.set("format", format);
      qs.set("lang", locale);
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
      toast.success(t("exportMenu.downloaded", { filename }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("exportMenu.exportFailed"),
      );
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
          <span>{isExporting ? t("exportMenu.exporting") : resolvedLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("exportMenu.chooseFormat")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.includes("pdf") && (
          <DropdownMenuItem
            onSelect={() => void handleExport("pdf")}
            className="cursor-pointer gap-2"
          >
            <FileTextIcon
              className="size-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium">
                {t("exportMenu.pdfTitle")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("exportMenu.pdfDesc")}
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
              className="size-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium">
                {t("exportMenu.excelTitle")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("exportMenu.excelDesc")}
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
              className="size-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium">
                {t("exportMenu.csvTitle")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("exportMenu.csvDesc")}
              </span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

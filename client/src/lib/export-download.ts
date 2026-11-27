import {
  buildExportFilename,
  serializeCsv,
  type ExportFileExtension,
} from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "./api-client";

export function parseContentDispositionFilename(
  headerValue: string | undefined,
): string | null {
  if (!headerValue) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      return utfMatch[1].trim();
    }
  }
  const plainMatch = /filename=([^;]+)/i.exec(headerValue);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

const MIME_BY_EXT: Record<ExportFileExtension, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8;",
  json: "application/json",
};

export interface DownloadExportApiOptions {
  url: string;
  method?: "get" | "post";
  data?: Record<string, unknown>;
  extension: ExportFileExtension;
  fallbackModule: string;
  fallbackIdentifier?: string;
}

export async function downloadExportFromApi(
  options: DownloadExportApiOptions,
): Promise<string> {
  const {
    url,
    method = "get",
    data,
    extension,
    fallbackModule,
    fallbackIdentifier,
  } = options;

  try {
    const response =
      method === "post"
        ? await apiClient.post(url, data, { responseType: "blob" })
        : await apiClient.get(url, { responseType: "blob" });

    const contentDisposition = response.headers?.["content-disposition"] as
      string | undefined;
    const filename =
      parseContentDispositionFilename(contentDisposition) ||
      buildExportFilename({
        module: fallbackModule,
        identifier: fallbackIdentifier,
        extension,
      });

    const blob = new Blob([response.data], { type: MIME_BY_EXT[extension] });
    triggerBlobDownload(blob, filename);
    return filename;
  } catch (err: unknown) {
    // Extract JSON error message from Blob responses if present
    const maybeAxiosErr = err as { response?: { data?: unknown } };
    if (maybeAxiosErr?.response?.data instanceof Blob) {
      try {
        const text = await maybeAxiosErr.response.data.text();
        const parsed = JSON.parse(text) as { message?: string; error?: string };
        throw new Error(parsed.message || parsed.error || "Export failed");
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== "Export failed") {
          throw parseErr;
        }
      }
    }
    throw new Error(extractErrorMessage(err, "Export generation failed"));
  }
}

export function downloadCsvFromTable(
  moduleName: string,
  headers: string[],
  rows: unknown[][],
): void {
  const csvContent = serializeCsv(headers, rows, { includeBom: true });
  const blob = new Blob([csvContent], { type: MIME_BY_EXT.csv });
  const filename = buildExportFilename({
    module: moduleName,
    extension: "csv",
  });
  triggerBlobDownload(blob, filename);
}

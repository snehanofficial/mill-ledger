export interface ExportOrganization {
  id?: string;
  code?: string;
  name?: string | null;
  gstin?: string | null;
  state?: string | null;
  address?: string | null;
}

export type ExportColumnType =
  | "text"
  | "number"
  | "currency"
  | "quantity"
  | "percent"
  | "date"
  | "datetime"
  | "boolean";

export interface ExportColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  type: ExportColumnType;
  width?: number;
  align?: "left" | "right" | "center";
  unit?: string;
  /** Optional value extractor when transforming domain objects */
  value?: (row: T) => unknown;
}

export interface ExportSummaryItem {
  label: string;
  value: string;
  bold?: boolean;
}

export interface ExportDocumentMeta {
  title: string;
  subtitle?: string;
  documentType: string;
  referenceId?: string;
  periodLabel?: string;
  scopeLabel?: string;
  generatedAt: Date;
  organization?: ExportOrganization | null;
  summaryItems?: ExportSummaryItem[];
  footerNote?: string;
}

export interface ExportTableSection<T = Record<string, unknown>> {
  title?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  totalsRow?: Record<string, unknown>;
}

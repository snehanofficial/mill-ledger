import { formatDateTime } from "@/lib/formatters";

export type ParsedAuditDetails =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "array"; data: unknown[]; raw: unknown }
  | { kind: "structured"; data: Record<string, unknown>; raw: unknown };

export interface AuditDiffEntry {
  field: string;
  label: string;
  kind: "added" | "removed" | "changed";
  before: string;
  after: string;
}

export type AuditBadgeVariant =
  "success" | "info" | "warning" | "danger" | "neutral";

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|apikey|api_key|privatekey|private_key|hash|credential)/i;

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

const KEY_LABEL_OVERRIDES: Record<string, string> = {
  id: "ID",
  entityId: "Entity ID",
  userId: "User ID",
  userEmail: "User Email",
  requestId: "Request ID",
  ipAddress: "IP Address",
  gstin: "GSTIN",
  sku: "SKU",
  hsn: "HSN",
  bom: "BOM",
  isActive: "Active",
  runNumber: "Run Number",
  orderNumber: "Order Number",
  invoiceNumber: "Invoice Number",
  dispatchNumber: "Dispatch Number",
  paymentNumber: "Payment Number",
  fromRecipeId: "Source Recipe ID",
};

/**
 * Parses raw audit `details` (JSON string, object, array, or plain text) into a typed structure.
 */
export function parseAuditDetails(details: unknown): ParsedAuditDetails {
  if (details === null || details === undefined) {
    return { kind: "empty" };
  }

  if (typeof details === "string") {
    const trimmed = details.trim();
    if (!trimmed) {
      return { kind: "empty" };
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed === null || parsed === undefined) {
        return { kind: "empty" };
      }
      if (Array.isArray(parsed)) {
        return { kind: "array", data: parsed, raw: parsed };
      }
      if (typeof parsed === "object") {
        return {
          kind: "structured",
          data: parsed as Record<string, unknown>,
          raw: parsed,
        };
      }
      return { kind: "text", text: String(parsed) };
    } catch {
      return { kind: "text", text: trimmed };
    }
  }

  if (Array.isArray(details)) {
    return { kind: "array", data: details, raw: details };
  }

  if (typeof details === "object") {
    return {
      kind: "structured",
      data: details as Record<string, unknown>,
      raw: details,
    };
  }

  return { kind: "text", text: String(details) };
}

/**
 * Converts camelCase, PascalCase, or snake_case keys into readable Title Case labels.
 */
export function humanizeKey(key: string): string {
  if (KEY_LABEL_OVERRIDES[key]) {
    return KEY_LABEL_OVERRIDES[key];
  }
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();

  if (!spaced) return key;

  return spaced
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (["ID", "GST", "SKU", "HSN", "BOM", "IP", "URL"].includes(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Converts PascalCase or snake_case entity names (e.g. "ProductionRun") into readable labels.
 */
export function humanizeEntity(entity: string): string {
  if (!entity) return "Unknown";
  return humanizeKey(entity);
}

/**
 * Masks sensitive values client-side when keys suggest credentials or tokens.
 */
export function maskSensitiveValue(key: string, value: unknown): unknown {
  if (!SENSITIVE_KEY_PATTERN.test(key)) {
    return value;
  }
  if (value === null || value === undefined || value === "") {
    return value;
  }
  const str = String(value);
  if (str.length <= 4) {
    return "••••";
  }
  return `••••••••${str.slice(-4)}`;
}

/**
 * Formats an audit field value into a concise, human-readable string.
 */
export function formatAuditValue(value: unknown, key = ""): string {
  const safeValue = maskSensitiveValue(key, value);

  if (safeValue === null || safeValue === undefined || safeValue === "") {
    return "None";
  }
  if (typeof safeValue === "boolean") {
    return safeValue ? "Yes" : "No";
  }
  if (typeof safeValue === "number") {
    return Number.isFinite(safeValue)
      ? safeValue.toLocaleString("en-IN")
      : String(safeValue);
  }
  if (typeof safeValue === "string") {
    if (ISO_DATE_PATTERN.test(safeValue) && safeValue.includes("T")) {
      return formatDateTime(safeValue);
    }
    return safeValue;
  }
  if (Array.isArray(safeValue)) {
    if (safeValue.length === 0) return "None";
    const allPrimitives = safeValue.every(
      (item) => item === null || typeof item !== "object",
    );
    if (allPrimitives) {
      return safeValue.map((item) => formatAuditValue(item)).join(", ");
    }
    return `${safeValue.length} ${safeValue.length === 1 ? "item" : "items"}`;
  }
  if (typeof safeValue === "object") {
    const keys = Object.keys(safeValue as Record<string, unknown>);
    if (keys.length === 0) return "Empty";
    return `${keys.length} ${keys.length === 1 ? "field" : "fields"}`;
  }
  return String(safeValue);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts before/after field diffs if the payload contains before/after, previous/next, or old/new objects.
 */
export function extractAuditDiff(
  data: Record<string, unknown>,
): AuditDiffEntry[] | null {
  let beforeObj: Record<string, unknown> | null = null;
  let afterObj: Record<string, unknown> | null = null;

  if (isPlainObject(data.before) || isPlainObject(data.after)) {
    beforeObj = isPlainObject(data.before) ? data.before : {};
    afterObj = isPlainObject(data.after) ? data.after : {};
  } else if (isPlainObject(data.previous) || isPlainObject(data.next)) {
    beforeObj = isPlainObject(data.previous) ? data.previous : {};
    afterObj = isPlainObject(data.next) ? data.next : {};
  } else if (isPlainObject(data.old) || isPlainObject(data.new)) {
    beforeObj = isPlainObject(data.old) ? data.old : {};
    afterObj = isPlainObject(data.new) ? data.new : {};
  }

  if (!beforeObj || !afterObj) {
    return null;
  }

  const allKeys = Array.from(
    new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]),
  );

  const diffs: AuditDiffEntry[] = [];
  for (const key of allKeys) {
    const hasBefore = key in beforeObj;
    const hasAfter = key in afterObj;
    const beforeVal = beforeObj[key];
    const afterVal = afterObj[key];

    if (!hasBefore && hasAfter) {
      diffs.push({
        field: key,
        label: humanizeKey(key),
        kind: "added",
        before: "",
        after: formatAuditValue(afterVal, key),
      });
    } else if (hasBefore && !hasAfter) {
      diffs.push({
        field: key,
        label: humanizeKey(key),
        kind: "removed",
        before: formatAuditValue(beforeVal, key),
        after: "",
      });
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diffs.push({
        field: key,
        label: humanizeKey(key),
        kind: "changed",
        before: formatAuditValue(beforeVal, key),
        after: formatAuditValue(afterVal, key),
      });
    }
  }

  return diffs;
}

/**
 * Generates a concise human-readable summary string for the audit table row.
 */
export function summarizeAuditDetails(
  details: unknown,
  reason?: string | null,
): string {
  const parsed = parseAuditDetails(details);

  if (parsed.kind === "empty") {
    return reason ? `Reason: ${reason}` : "No additional details";
  }

  if (parsed.kind === "text") {
    return reason ? `${parsed.text} (Reason: ${reason})` : parsed.text;
  }

  if (parsed.kind === "array") {
    const countLabel = `${parsed.data.length} ${parsed.data.length === 1 ? "entry" : "entries"}`;
    return reason ? `${countLabel} (Reason: ${reason})` : countLabel;
  }

  const diffs = extractAuditDiff(parsed.data);
  if (diffs !== null) {
    if (diffs.length === 0) {
      return reason
        ? `No field changes (Reason: ${reason})`
        : "No field changes";
    }
    const preview = diffs
      .slice(0, 2)
      .map((d) => d.label)
      .join(", ");
    const extra = diffs.length > 2 ? ` +${diffs.length - 2} more` : "";
    const diffSummary = `Changed ${preview}${extra}`;
    return reason ? `${diffSummary} (Reason: ${reason})` : diffSummary;
  }

  const entries = Object.entries(parsed.data).filter(
    ([, val]) => val !== null && val !== undefined && val !== "",
  );
  if (entries.length === 0) {
    return reason ? `Reason: ${reason}` : "No additional details";
  }

  const previewParts = entries.slice(0, 3).map(([key, val]) => {
    return `${humanizeKey(key)}: ${formatAuditValue(val, key)}`;
  });

  const extra = entries.length > 3 ? ` (+${entries.length - 3} more)` : "";
  const summary = `${previewParts.join(" · ")}${extra}`;
  return reason ? `${summary} · Reason: ${reason}` : summary;
}

/**
 * Maps an audit action verb to a semantic Badge variant (paired with text, never color alone).
 */
export function getActionBadgeVariant(action: string): AuditBadgeVariant {
  const normalized = (action || "").toUpperCase();
  if (
    ["CREATE", "POST", "APPROVE", "RESTORE", "ALLOCATE", "COMPLETE"].includes(
      normalized,
    )
  ) {
    return "success";
  }
  if (
    [
      "UPDATE",
      "DISPATCH",
      "EXPORT",
      "CREATE_VERSION",
      "SUBMIT",
      "EDIT",
    ].includes(normalized)
  ) {
    return "info";
  }
  if (
    [
      "REVERSE",
      "ARCHIVE",
      "SALES_RETURN",
      "BOUNCE",
      "BOUNCED",
      "ADJUST",
    ].includes(normalized)
  ) {
    return "warning";
  }
  if (["DELETE", "VOID", "REJECT", "CANCEL", "REVOKE"].includes(normalized)) {
    return "danger";
  }
  return "neutral";
}

/**
 * Formats raw details for the Raw JSON inspector view.
 */
export function formatRawAuditJson(details: unknown): string {
  const parsed = parseAuditDetails(details);
  if (parsed.kind === "empty") {
    return "{}";
  }
  if (parsed.kind === "text") {
    return parsed.text;
  }
  return JSON.stringify(parsed.raw, null, 2);
}

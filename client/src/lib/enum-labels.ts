import { i18n } from "@/i18n";

const STATUS_KEY_MAP: Record<string, string> = {
  DRAFT: "status.draft",
  SUBMITTED: "status.submitted",
  APPROVED: "status.approved",
  REJECTED: "status.rejected",
  DISPATCHED: "status.dispatched",
  INVOICED: "status.invoiced",
  CANCELLED: "status.cancelled",
  PENDING: "status.pending",
  PARTIALLY_PAID: "status.partiallyPaid",
  PAID: "status.paid",
  OVERDUE: "status.overdue",
  POSTED: "status.posted",
  REVERSED: "status.reversed",
  ACTIVE: "status.active",
  INACTIVE: "status.inactive",
  COMPLETED: "status.completed",
  IN_PROGRESS: "status.inProgress",
  BALANCED: "status.balanced",
  DISCREPANCY: "status.discrepancy",
  SUFFICIENT: "status.sufficient",
  SHORTAGE_FLAGGED: "status.shortageFlagged",
  IN_STOCK: "status.inStock",
  LOW_STOCK: "status.lowStock",
  OUT_OF_STOCK: "status.outOfStock",
  UNALLOCATED: "status.unallocated",
  BOUNCED: "status.bounced",
};

const tCommon = (key: string): string =>
  (i18n.t as unknown as (k: string, opts?: { ns?: string }) => string)(key, {
    ns: "common",
  });

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  const normalized = status.trim().toUpperCase();
  const key = STATUS_KEY_MAP[normalized];
  if (key) {
    return tCommon(key);
  }
  return status.replaceAll("_", " ");
}

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "";
  const normalized = role.trim().toUpperCase();
  const key = `roles.${normalized}`;
  if (i18n.exists(key, { ns: "common" })) {
    return tCommon(key);
  }
  return role;
}

export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return "";
  const normalized = category.trim().toUpperCase();
  const key = `categories.${normalized}`;
  if (i18n.exists(key, { ns: "common" })) {
    return tCommon(key);
  }
  return category.replaceAll("_", " ");
}

export function getPaymentMethodLabel(
  method: string | null | undefined,
): string {
  if (!method) return "";
  const normalized = method.trim().toUpperCase();
  const key = `paymentMethods.${normalized}`;
  if (i18n.exists(key, { ns: "common" })) {
    return tCommon(key);
  }
  return method.replaceAll("_", " ");
}

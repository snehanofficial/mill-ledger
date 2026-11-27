import type {
  EntityTimelineResponse,
  Resource,
  Role,
  TimelineActorType,
  TimelineCategory,
  TimelineChangeEntry,
  TimelineEntityType,
  TimelineEvent,
  TimelineFilterType,
  TimelineRelatedRecordRef,
  TimelineRelationshipType,
  UserContext,
} from "@mill-ledger/shared";
import type { AuditLog } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/error.middleware.js";
import { hasRbacPermission } from "../../policies/rbac.js";

const ROUTE_ALLOWED_ROLES: Record<string, Role[]> = {
  order: ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  invoice: ["ADMIN", "ACCOUNTANT", "OWNER"],
  payment: ["ADMIN", "ACCOUNTANT", "OWNER"],
  dispatch: ["ADMIN", "OWNER"],
  customer: ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  product: ["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  recipe: ["ADMIN", "PRODUCTION", "OWNER"],
  production_run: ["ADMIN", "PRODUCTION", "OWNER"],
};

function canAccessRoute(role: Role, key: string): boolean {
  const allowed = ROUTE_ALLOWED_ROLES[key];
  return allowed ? allowed.includes(role) : false;
}

function normalizeEntityName(entity: string): string {
  const lower = entity.toLowerCase();
  if (lower === "salesorder" || lower === "sales_order" || lower === "order") {
    return "SalesOrder";
  }
  if (lower === "salesinvoice" || lower === "sales_invoice" || lower === "invoice") {
    return "SalesInvoice";
  }
  if (lower === "payment") return "Payment";
  if (lower === "customer") return "Customer";
  if (lower === "product") return "Product";
  if (lower === "productvariant" || lower === "product_variant") return "ProductVariant";
  if (lower === "pricelistline" || lower === "price_list_line") return "PriceListLine";
  if (lower === "recipe") return "Recipe";
  if (lower === "productionrun" || lower === "production_run") return "ProductionRun";
  if (lower === "dispatch") return "Dispatch";
  if (lower === "creditnote" || lower === "credit_note") return "CreditNote";
  if (lower === "stockmovement" || lower === "stock_movement") return "StockMovement";
  return entity;
}

function entityResource(canonicalEntity: string): Resource | null {
  switch (canonicalEntity) {
    case "SalesOrder":
      return "order";
    case "SalesInvoice":
    case "CreditNote":
      return "invoice";
    case "Payment":
      return "payment";
    case "Customer":
      return "customer";
    case "Product":
    case "ProductVariant":
    case "PriceListLine":
    case "StockMovement":
      return "inventory";
    case "Recipe":
    case "ProductionRun":
      return "production_run";
    case "Dispatch":
      return "order";
    default:
      return null;
  }
}

function buildRouteForEntity(
  role: Role,
  canonicalEntity: string,
  entityId: string,
): string | null {
  if (!entityId) return null;
  switch (canonicalEntity) {
    case "SalesOrder":
      return canAccessRoute(role, "order") ? `/orders/${entityId}` : null;
    case "SalesInvoice":
      return canAccessRoute(role, "invoice") ? `/invoices/${entityId}` : null;
    case "Payment":
      return canAccessRoute(role, "payment") ? `/payments/${entityId}` : null;
    case "Dispatch":
      return canAccessRoute(role, "dispatch") ? `/dispatch/${entityId}` : null;
    case "Customer":
      return canAccessRoute(role, "customer") ? `/customers/${entityId}` : null;
    case "Product":
      return canAccessRoute(role, "product") ? `/products/${entityId}` : null;
    case "Recipe":
      return canAccessRoute(role, "recipe") ? `/production/recipes/${entityId}` : null;
    case "ProductionRun":
      return canAccessRoute(role, "production_run") ? `/production/runs/${entityId}` : null;
    default:
      return null;
  }
}

function parseDetailsJson(details: string | null | undefined): Record<string, unknown> {
  if (!details) return {};
  try {
    const parsed: unknown = JSON.parse(details);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function formatMoneyValue(val: unknown): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val ?? "None");
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stringifyChangeValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "None";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return val.toLocaleString("en-IN");
  return String(val);
}

function extractChangesFromAuditLog(log: AuditLog, details: Record<string, unknown>): TimelineChangeEntry[] {
  if (Array.isArray(log.changes)) {
    return (log.changes as unknown[])
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null && !Array.isArray(c))
      .map((c) => ({
        field: String(c.field ?? ""),
        label: String(c.label ?? c.field ?? "Field"),
        kind:
          c.kind === "added" || c.kind === "removed" || c.kind === "changed"
            ? c.kind
            : "changed",
        previousValue: stringifyChangeValue(c.previousValue),
        newValue: stringifyChangeValue(c.newValue),
      }));
  }

  const beforeObj =
    typeof details.before === "object" && details.before !== null
      ? (details.before as Record<string, unknown>)
      : typeof details.previous === "object" && details.previous !== null
        ? (details.previous as Record<string, unknown>)
        : null;
  const afterObj =
    typeof details.after === "object" && details.after !== null
      ? (details.after as Record<string, unknown>)
      : typeof details.next === "object" && details.next !== null
        ? (details.next as Record<string, unknown>)
        : null;

  if (!beforeObj || !afterObj) return [];

  const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));
  const out: TimelineChangeEntry[] = [];
  for (const key of keys) {
    const prev = beforeObj[key];
    const next = afterObj[key];
    if (JSON.stringify(prev) === JSON.stringify(next)) continue;
    out.push({
      field: key,
      label: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
      kind: !(key in beforeObj) ? "added" : !(key in afterObj) ? "removed" : "changed",
      previousValue: stringifyChangeValue(prev),
      newValue: stringifyChangeValue(next),
    });
  }
  return out;
}

function buildTitleAndSummary(
  canonicalEntity: string,
  action: string,
  eventType: string | null,
  summary: string | null,
  details: Record<string, unknown>,
  labelMap: Map<string, string>,
  entityId: string,
): { title: string; summary: string } {
  const act = (action || "").toUpperCase();
  const evt = (eventType || "").toUpperCase();
  const entityLabel = labelMap.get(`${canonicalEntity}:${entityId}`) || entityId;

  if (canonicalEntity === "SalesOrder") {
    if (act === "CREATE" || evt === "ORDER_CREATED") {
      return {
        title: "Order created",
        summary: summary || `Order ${entityLabel} created (${String(details.status ?? "DRAFT")})`,
      };
    }
    if (act === "SUBMIT" || evt === "ORDER_SUBMITTED") {
      return {
        title: "Order submitted",
        summary: summary || `Order ${entityLabel} submitted for review`,
      };
    }
    if (act === "APPROVE" || evt === "ORDER_APPROVED") {
      return {
        title: "Order approved",
        summary: summary || `Order ${entityLabel} approved and stock reserved`,
      };
    }
    if (act === "REJECT" || evt === "ORDER_REJECTED") {
      return {
        title: "Order rejected",
        summary: summary || `Order ${entityLabel} rejected`,
      };
    }
    if (act === "UPDATE" || evt === "ORDER_UPDATED") {
      return {
        title: "Order modified",
        summary: summary || `Order ${entityLabel} details updated`,
      };
    }
  }

  if (canonicalEntity === "SalesInvoice") {
    if (act === "POST" || evt === "INVOICE_POSTED") {
      return {
        title: "Invoice issued",
        summary:
          summary ||
          `Invoice ${entityLabel} posted for ${formatMoneyValue(details.totalAmount ?? 0)}`,
      };
    }
  }

  if (canonicalEntity === "CreditNote") {
    return {
      title: "Credit note issued",
      summary:
        summary ||
        `Credit note ${String(details.creditNoteNumber ?? entityLabel)} issued for ${formatMoneyValue(details.totalAmount ?? 0)}`,
    };
  }

  if (canonicalEntity === "Payment") {
    if (act === "CREATE" || evt === "PAYMENT_RECORDED") {
      return {
        title: "Payment recorded",
        summary:
          summary ||
          `Payment ${entityLabel} recorded for ${formatMoneyValue(details.amount ?? 0)}`,
      };
    }
    if (act === "PAYMENT_ALLOCATED" || evt === "PAYMENT_ALLOCATED") {
      return {
        title: "Payment allocated",
        summary:
          summary ||
          `${formatMoneyValue(details.allocatedAmount ?? 0)} allocated from ${entityLabel}`,
      };
    }
    if (act === "PAYMENT_ALLOCATION_REVERSED" || evt === "PAYMENT_ALLOCATION_REVERSED") {
      return {
        title: "Payment allocation reversed",
        summary:
          summary ||
          `Allocation of ${formatMoneyValue(details.amount ?? 0)} on ${String(details.invoiceNumber ?? "invoice")} reversed`,
      };
    }
    if (act === "PAYMENT_BOUNCED" || evt === "PAYMENT_BOUNCED") {
      return {
        title: "Payment bounced",
        summary: summary || `Payment ${entityLabel} marked as bounced`,
      };
    }
    if (act === "PAYMENT_REVERSED" || evt === "PAYMENT_REVERSED") {
      return {
        title: "Payment reversed",
        summary: summary || `Payment ${entityLabel} reversed`,
      };
    }
  }

  if (canonicalEntity === "Dispatch") {
    if (act === "SALES_RETURN") {
      return {
        title: "Sales return recorded",
        summary: summary || `Sales return recorded against dispatch ${entityLabel}`,
      };
    }
    return {
      title: "Dispatch posted",
      summary: summary || `Dispatch ${entityLabel} posted`,
    };
  }

  if (canonicalEntity === "Customer") {
    if (act === "CREATE") {
      return { title: "Customer created", summary: summary || `Customer ${entityLabel} created` };
    }
    if (act === "ASSIGN_SALESMAN") {
      return {
        title: "Salesman assigned",
        summary: summary || `Assigned ${String(details.salesmanEmail ?? "salesman")} to ${entityLabel}`,
      };
    }
    if (act === "UNASSIGN_SALESMAN") {
      return {
        title: "Salesman unassigned",
        summary: summary || `Removed salesman assignment from ${entityLabel}`,
      };
    }
    if (act === "ARCHIVE") {
      return { title: "Customer archived", summary: summary || `Customer ${entityLabel} archived` };
    }
    if (act === "RESTORE") {
      return { title: "Customer restored", summary: summary || `Customer ${entityLabel} restored` };
    }
    return { title: "Customer profile updated", summary: summary || `Customer ${entityLabel} updated` };
  }

  if (canonicalEntity === "Product") {
    if (act === "CREATE") {
      return { title: "Product created", summary: summary || `Product ${entityLabel} created` };
    }
    if (act === "ARCHIVE") {
      return { title: "Product archived", summary: summary || `Product ${entityLabel} archived` };
    }
    if (act === "RESTORE") {
      return { title: "Product restored", summary: summary || `Product ${entityLabel} restored` };
    }
    return { title: "Product updated", summary: summary || `Product ${entityLabel} updated` };
  }

  if (canonicalEntity === "ProductVariant") {
    if (act === "CREATE") {
      return {
        title: "Pack size variant added",
        summary: summary || `Variant ${String(details.name ?? details.sku ?? entityLabel)} added`,
      };
    }
    if (act === "DELETE") {
      return {
        title: "Pack size variant deleted",
        summary: summary || `Variant ${String(details.sku ?? entityLabel)} deleted`,
      };
    }
    return {
      title: "Pack size variant updated",
      summary: summary || `Variant ${String(details.sku ?? entityLabel)} updated`,
    };
  }

  if (canonicalEntity === "PriceListLine") {
    return {
      title: "Price list rate updated",
      summary:
        summary ||
        `Rate for ${String(details.variantSku ?? "variant")} set to ${formatMoneyValue(details.price ?? 0)}`,
    };
  }

  if (canonicalEntity === "Recipe") {
    if (act === "CREATE") {
      return { title: "Recipe created", summary: summary || `Recipe ${entityLabel} created` };
    }
    if (act === "CREATE_VERSION") {
      return {
        title: "New recipe revision created",
        summary: summary || `Recipe ${entityLabel} cloned as v${String(details.version ?? "")}`,
      };
    }
    if (act === "ARCHIVE") {
      return { title: "Recipe archived", summary: summary || `Recipe ${entityLabel} archived` };
    }
    if (act === "RESTORE") {
      return { title: "Recipe restored", summary: summary || `Recipe ${entityLabel} restored` };
    }
    return { title: "Recipe updated", summary: summary || `Recipe ${entityLabel} updated` };
  }

  if (canonicalEntity === "ProductionRun") {
    if (act === "CREATE") {
      return {
        title: "Production batch started",
        summary: summary || `Production run ${entityLabel} created`,
      };
    }
    if (act === "POST") {
      return {
        title: "Production run posted",
        summary: summary || `Production run ${entityLabel} posted`,
      };
    }
    if (act === "REVERSE") {
      return {
        title: "Production run reversed",
        summary: summary || `Production run ${entityLabel} reversed`,
      };
    }
    return {
      title: "Production run updated",
      summary: summary || `Production run ${entityLabel} updated`,
    };
  }

  return {
    title: `${canonicalEntity} ${act.toLowerCase()}`,
    summary: summary || `${canonicalEntity} ${entityLabel} ${act.toLowerCase()}`,
  };
}

function classifyCategory(
  canonicalEntity: string,
  action: string,
  relationshipType: TimelineRelationshipType,
  actorType: TimelineActorType,
): TimelineCategory {
  if (actorType === "SYSTEM" && relationshipType === "DIRECT" && action === "BASELINE") {
    return "SYSTEM";
  }
  if (
    canonicalEntity === "SalesInvoice" ||
    canonicalEntity === "CreditNote" ||
    canonicalEntity === "Payment" ||
    canonicalEntity === "PriceListLine"
  ) {
    return "FINANCIAL";
  }
  if (
    canonicalEntity === "Dispatch" ||
    canonicalEntity === "ProductionRun" ||
    canonicalEntity === "StockMovement"
  ) {
    return "OPERATIONAL";
  }
  if (relationshipType === "DIRECT") {
    const act = action.toUpperCase();
    if (["APPROVE", "REJECT", "SUBMIT", "ARCHIVE", "RESTORE", "POST", "CREATE_VERSION"].includes(act)) {
      return "LIFECYCLE";
    }
    return "DIRECT";
  }
  return "RELATED";
}

function matchesFilter(event: TimelineEvent, filter: TimelineFilterType): boolean {
  if (filter === "ALL") return true;
  if (filter === "DIRECT") {
    return event.relationshipType === "DIRECT";
  }
  if (filter === "RELATED") {
    return event.relationshipType !== "DIRECT";
  }
  if (filter === "FINANCIAL") {
    return event.category === "FINANCIAL";
  }
  if (filter === "OPERATIONAL") {
    return event.category === "OPERATIONAL";
  }
  return true;
}

interface CandidateLog {
  log: AuditLog;
  canonicalEntity: string;
  relationshipType: TimelineRelationshipType;
  relationshipLabel: string;
}

export class TimelineService {
  async getEntityTimeline(params: {
    organizationId: string;
    user: UserContext;
    entityType: TimelineEntityType;
    entityId: string;
    filter: TimelineFilterType;
    limit: number;
    offset: number;
  }): Promise<EntityTimelineResponse> {
    const { organizationId, user, entityType, entityId, filter, limit, offset } = params;

    let entityLabel = entityId;
    const candidates: CandidateLog[] = [];
    const baselineEvents: TimelineEvent[] = [];
    const labelMap = new Map<string, string>();

    switch (entityType) {
      case "order": {
        const res = await this.resolveOrder(organizationId, user, entityId, labelMap);
        entityLabel = res.label;
        candidates.push(...res.candidates);
        baselineEvents.push(...res.baselines);
        break;
      }
      case "invoice": {
        const res = await this.resolveInvoice(organizationId, user, entityId, labelMap);
        entityLabel = res.label;
        candidates.push(...res.candidates);
        baselineEvents.push(...res.baselines);
        break;
      }
      case "payment": {
        const res = await this.resolvePayment(organizationId, user, entityId, labelMap);
        entityLabel = res.label;
        candidates.push(...res.candidates);
        baselineEvents.push(...res.baselines);
        break;
      }
      case "customer": {
        const res = await this.resolveCustomer(organizationId, user, entityId, labelMap);
        entityLabel = res.label;
        candidates.push(...res.candidates);
        baselineEvents.push(...res.baselines);
        break;
      }
      case "product": {
        const res = await this.resolveProduct(organizationId, user, entityId, labelMap);
        entityLabel = res.label;
        candidates.push(...res.candidates);
        baselineEvents.push(...res.baselines);
        break;
      }
      case "recipe": {
        const res = await this.resolveRecipe(organizationId, user, entityId, labelMap);
        entityLabel = res.label;
        candidates.push(...res.candidates);
        baselineEvents.push(...res.baselines);
        break;
      }
    }

    // Deduplicate audit logs by ID and convert to TimelineEvent
    const seenIds = new Set<string>();
    const coveredMilestones = new Set<string>();
    const allEvents: TimelineEvent[] = [];

    for (const item of candidates) {
      const { log, canonicalEntity, relationshipType, relationshipLabel } = item;
      if (seenIds.has(log.id)) continue;

      // Enforce RBAC on related entity before exposing it
      const resource = entityResource(canonicalEntity);
      if (resource && !hasRbacPermission(user.role, resource, "read")) {
        continue;
      }

      seenIds.add(log.id);

      const oid = log.entityId ?? entityId;
      coveredMilestones.add(`${canonicalEntity}:${oid}:${log.action.toUpperCase()}`);

      const details = parseDetailsJson(log.details);
      const changes = extractChangesFromAuditLog(log, details);
      const { title, summary } = buildTitleAndSummary(
        canonicalEntity,
        log.action,
        log.eventType,
        log.summary,
        details,
        labelMap,
        oid,
      );

      const actorType: TimelineActorType =
        log.actorType === "SYSTEM" || log.actorType === "OFFLINE_SYNC"
          ? log.actorType
          : "USER";

      const category = classifyCategory(canonicalEntity, log.action, relationshipType, actorType);

      const relatedRecords: TimelineRelatedRecordRef[] = [];
      if (Array.isArray(log.relatedEntities)) {
        for (const rawRel of log.relatedEntities) {
          if (typeof rawRel !== "object" || rawRel === null) continue;
          const relObj = rawRel as Record<string, unknown>;
          const relEntity = normalizeEntityName(String(relObj.entityType ?? ""));
          const relId = String(relObj.entityId ?? "");
          if (!relEntity || !relId) continue;

          const relRes = entityResource(relEntity);
          if (relRes && !hasRbacPermission(user.role, relRes, "read")) {
            continue;
          }

          const relLabel =
            String(relObj.label ?? "") ||
            labelMap.get(`${relEntity}:${relId}`) ||
            relId;

          relatedRecords.push({
            entityType: relEntity,
            entityId: relId,
            label: relLabel,
            route: buildRouteForEntity(user.role, relEntity, relId),
          });
        }
      }

      const originLabel = labelMap.get(`${canonicalEntity}:${oid}`) || oid;

      allEvents.push({
        id: log.id,
        eventType: log.eventType || `${canonicalEntity.toUpperCase()}_${log.action.toUpperCase()}`,
        action: log.action,
        title,
        summary,
        category,
        relationshipType,
        relationshipLabel,
        originEntityType: canonicalEntity,
        originEntityId: oid,
        originEntityLabel: originLabel,
        originRoute: buildRouteForEntity(user.role, canonicalEntity, oid),
        occurredAt: (log.occurredAt ?? log.timestamp).toISOString(),
        recordedAt: log.timestamp.toISOString(),
        actorName:
          log.actorName ||
          (log.userEmail ? log.userEmail.split("@")[0] : actorType === "SYSTEM" ? "System" : "Staff"),
        actorEmail: log.userEmail ?? null,
        actorType,
        source: log.source || "API",
        reason: log.reason ?? null,
        correlationId: log.correlationId ?? log.requestId ?? null,
        isBaseline: false,
        changes,
        relatedRecords,
        metadata: Object.keys(details).length > 0 ? details : null,
      });
    }

    // Add baseline events only when no matching recorded audit log exists
    let hasBaselines = false;
    for (const base of baselineEvents) {
      const baseKey = `${base.originEntityType}:${base.originEntityId}:${base.action.toUpperCase()}`;
      if (coveredMilestones.has(baseKey)) continue;
      hasBaselines = true;
      allEvents.push(base);
    }

    // Sort newest-first
    allEvents.sort((a, b) => {
      const diff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (diff !== 0) return diff;
      return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
    });

    const availableFilters: TimelineFilterType[] = ["ALL"];
    if (allEvents.some((e) => matchesFilter(e, "DIRECT"))) availableFilters.push("DIRECT");
    if (allEvents.some((e) => matchesFilter(e, "RELATED"))) availableFilters.push("RELATED");
    if (allEvents.some((e) => matchesFilter(e, "FINANCIAL"))) availableFilters.push("FINANCIAL");
    if (allEvents.some((e) => matchesFilter(e, "OPERATIONAL"))) availableFilters.push("OPERATIONAL");

    const filtered = allEvents.filter((e) => matchesFilter(e, filter));
    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return {
      entity: {
        entityType,
        entityId,
        label: entityLabel,
      },
      events: paged,
      availableFilters,
      coverageNote: hasBaselines
        ? "Some earlier milestones reflect recorded document baselines created before detailed field-level audit tracking."
        : null,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + paged.length < total,
      },
    };
  }

  private async resolveOrder(
    organizationId: string,
    user: UserContext,
    orderId: string,
    labelMap: Map<string, string>,
  ) {
    if (!hasRbacPermission(user.role, "order", "read")) {
      throw new AppError("Forbidden: Insufficient permissions to view order timeline", 403);
    }

    const order = await prisma.salesOrder.findFirst({
      where: { id: orderId, organizationId },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            postedAt: true,
            creditNotes: {
              select: { id: true, creditNoteNumber: true, totalAmount: true, postedAt: true },
            },
            paymentAllocations: {
              select: {
                id: true,
                amount: true,
                allocatedAt: true,
                isReversed: true,
                reversedAt: true,
                payment: {
                  select: { id: true, paymentNumber: true, paymentMode: true, status: true },
                },
              },
            },
          },
        },
        dispatches: {
          select: { id: true, dispatchNumber: true, status: true, dispatchedAt: true },
        },
      },
    });

    if (!order) {
      throw new AppError(`Order ${orderId} not found`, 404);
    }

    if (user.role === "SALESMAN" && order.salesmanId !== user.id) {
      throw new AppError("Forbidden: Salesmen can only view their own orders", 403);
    }

    labelMap.set(`SalesOrder:${order.id}`, order.orderNumber);
    labelMap.set(`Customer:${order.customer.id}`, order.customer.name);

    const invoiceIds = order.invoices.map((i) => i.id);
    const creditNoteIds: string[] = [];
    const paymentIds = new Set<string>();

    for (const inv of order.invoices) {
      labelMap.set(`SalesInvoice:${inv.id}`, inv.invoiceNumber);
      for (const cn of inv.creditNotes) {
        creditNoteIds.push(cn.id);
        labelMap.set(`CreditNote:${cn.id}`, cn.creditNoteNumber);
      }
      for (const alloc of inv.paymentAllocations) {
        paymentIds.add(alloc.payment.id);
        labelMap.set(`Payment:${alloc.payment.id}`, alloc.payment.paymentNumber);
      }
    }

    const dispatchIds = order.dispatches.map((d) => d.id);
    for (const dsp of order.dispatches) {
      labelMap.set(`Dispatch:${dsp.id}`, dsp.dispatchNumber);
    }

    const canReadInvoice = hasRbacPermission(user.role, "invoice", "read");
    const canReadPayment = hasRbacPermission(user.role, "payment", "read");

    const orClauses: Array<{ entity: { in: string[] }; entityId: { in: string[] } }> = [
      { entity: { in: ["SalesOrder"] }, entityId: { in: [order.id] } },
      ...(dispatchIds.length > 0
        ? [{ entity: { in: ["Dispatch"] }, entityId: { in: dispatchIds } }]
        : []),
    ];

    if (canReadInvoice && invoiceIds.length > 0) {
      orClauses.push({ entity: { in: ["SalesInvoice"] }, entityId: { in: invoiceIds } });
    }
    if (canReadInvoice && creditNoteIds.length > 0) {
      orClauses.push({ entity: { in: ["CreditNote"] }, entityId: { in: creditNoteIds } });
    }
    if (canReadPayment && paymentIds.size > 0) {
      orClauses.push({
        entity: { in: ["Payment", "payment"] },
        entityId: { in: Array.from(paymentIds) },
      });
    }

    const logs = await prisma.auditLog.findMany({
      where: { organizationId, OR: orClauses },
      orderBy: { timestamp: "desc" },
      take: 250,
    });

    const invoiceIdSet = new Set(invoiceIds);
    const candidates: CandidateLog[] = [];

    for (const log of logs) {
      const canonical = normalizeEntityName(log.entity);
      if (canonical === "SalesOrder") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "DIRECT",
          relationshipLabel: `Direct event · Order ${order.orderNumber}`,
        });
      } else if (canonical === "Dispatch") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Fulfilment dispatch · Order ${order.orderNumber}`,
        });
      } else if (canonical === "SalesInvoice") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Invoice generated from Order ${order.orderNumber}`,
        });
      } else if (canonical === "CreditNote") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "IMPACT",
          relationshipLabel: `Credit note on invoice from Order ${order.orderNumber}`,
        });
      } else if (canonical === "Payment") {
        // Relevance rule: only include payment events that affect an invoice of this order
        const details = parseDetailsJson(log.details);
        const relIds = Array.isArray(log.relatedEntities)
          ? (log.relatedEntities as Array<Record<string, unknown>>)
              .filter((r) => normalizeEntityName(String(r.entityType ?? "")) === "SalesInvoice")
              .map((r) => String(r.entityId ?? ""))
          : [];
        const detailInvId = typeof details.salesInvoiceId === "string" ? details.salesInvoiceId : null;
        const allocArr = Array.isArray(details.allocations)
          ? (details.allocations as Array<Record<string, unknown>>).map((a) =>
              String(a.salesInvoiceId ?? ""),
            )
          : [];
        const referencedInvoices = new Set([...relIds, ...allocArr, ...(detailInvId ? [detailInvId] : [])]);

        // If the log explicitly references invoices, require intersection with this order's invoices.
        // If it's a PAYMENT_BOUNCED/REVERSED or legacy log without invoice refs, check if payment is linked.
        const isAllocationEvent =
          log.action === "PAYMENT_ALLOCATED" || log.action === "PAYMENT_ALLOCATION_REVERSED";
        if (isAllocationEvent && referencedInvoices.size > 0) {
          const intersects = Array.from(referencedInvoices).some((id) => invoiceIdSet.has(id));
          if (!intersects) continue;
        }
        if (log.action === "CREATE" && referencedInvoices.size > 0) {
          const intersects = Array.from(referencedInvoices).some((id) => invoiceIdSet.has(id));
          if (!intersects) continue;
        }

        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "IMPACT",
          relationshipLabel: `Payment → Invoice → Order ${order.orderNumber}`,
        });
      }
    }

    const baselines: TimelineEvent[] = [
      {
        id: `baseline:SalesOrder:${order.id}:CREATE`,
        eventType: "ORDER_CREATED",
        action: "CREATE",
        title: "Order created",
        summary: `Order ${order.orderNumber} recorded for ${order.customer.name}`,
        category: "DIRECT",
        relationshipType: "DIRECT",
        relationshipLabel: `Direct event · Order ${order.orderNumber}`,
        originEntityType: "SalesOrder",
        originEntityId: order.id,
        originEntityLabel: order.orderNumber,
        originRoute: buildRouteForEntity(user.role, "SalesOrder", order.id),
        occurredAt: order.createdAt.toISOString(),
        recordedAt: order.createdAt.toISOString(),
        actorName: "System baseline",
        actorEmail: null,
        actorType: "SYSTEM",
        source: "RECORD_BASELINE",
        reason: null,
        correlationId: null,
        isBaseline: true,
        changes: [],
        relatedRecords: [],
        metadata: null,
      },
    ];

    return { label: order.orderNumber, candidates, baselines };
  }

  private async resolveInvoice(
    organizationId: string,
    user: UserContext,
    invoiceId: string,
    labelMap: Map<string, string>,
  ) {
    if (!hasRbacPermission(user.role, "invoice", "read")) {
      throw new AppError("Forbidden: Insufficient permissions to view invoice timeline", 403);
    }

    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        customer: { select: { id: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true, salesmanId: true } },
        creditNotes: {
          select: { id: true, creditNoteNumber: true, totalAmount: true, postedAt: true },
        },
        dispatches: {
          select: { id: true, dispatchNumber: true, dispatchedAt: true },
        },
        paymentAllocations: {
          select: {
            id: true,
            amount: true,
            allocatedAt: true,
            payment: {
              select: { id: true, paymentNumber: true, paymentMode: true, status: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new AppError(`Invoice ${invoiceId} not found`, 404);
    }

    labelMap.set(`SalesInvoice:${invoice.id}`, invoice.invoiceNumber);
    labelMap.set(`Customer:${invoice.customerId}`, invoice.customer.name);
    if (invoice.salesOrder) {
      labelMap.set(`SalesOrder:${invoice.salesOrder.id}`, invoice.salesOrder.orderNumber);
    }
    for (const cn of invoice.creditNotes) {
      labelMap.set(`CreditNote:${cn.id}`, cn.creditNoteNumber);
    }
    for (const dsp of invoice.dispatches) {
      labelMap.set(`Dispatch:${dsp.id}`, dsp.dispatchNumber);
    }
    for (const alloc of invoice.paymentAllocations) {
      labelMap.set(`Payment:${alloc.payment.id}`, alloc.payment.paymentNumber);
    }

    const canReadOrder =
      hasRbacPermission(user.role, "order", "read") &&
      (user.role !== "SALESMAN" || invoice.salesOrder?.salesmanId === user.id);
    const canReadPayment = hasRbacPermission(user.role, "payment", "read");

    const creditNoteIds = invoice.creditNotes.map((c) => c.id);
    const dispatchIds = invoice.dispatches.map((d) => d.id);
    const paymentIds = Array.from(new Set(invoice.paymentAllocations.map((a) => a.payment.id)));

    const orClauses: Array<{ entity: { in: string[] }; entityId: { in: string[] } }> = [
      { entity: { in: ["SalesInvoice"] }, entityId: { in: [invoice.id] } },
      ...(creditNoteIds.length > 0
        ? [{ entity: { in: ["CreditNote"] }, entityId: { in: creditNoteIds } }]
        : []),
      ...(dispatchIds.length > 0 && hasRbacPermission(user.role, "order", "read")
        ? [{ entity: { in: ["Dispatch"] }, entityId: { in: dispatchIds } }]
        : []),
    ];

    if (canReadOrder && invoice.salesOrderId) {
      orClauses.push({ entity: { in: ["SalesOrder"] }, entityId: { in: [invoice.salesOrderId] } });
    }
    if (canReadPayment && paymentIds.length > 0) {
      orClauses.push({ entity: { in: ["Payment", "payment"] }, entityId: { in: paymentIds } });
    }

    const logs = await prisma.auditLog.findMany({
      where: { organizationId, OR: orClauses },
      orderBy: { timestamp: "desc" },
      take: 250,
    });

    const candidates: CandidateLog[] = [];
    for (const log of logs) {
      const canonical = normalizeEntityName(log.entity);
      if (canonical === "SalesInvoice") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "DIRECT",
          relationshipLabel: `Direct event · Invoice ${invoice.invoiceNumber}`,
        });
      } else if (canonical === "CreditNote") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "DIRECT",
          relationshipLabel: `Credit note issued against Invoice ${invoice.invoiceNumber}`,
        });
      } else if (canonical === "SalesOrder") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Source order · ${invoice.salesOrder?.orderNumber ?? ""}`,
        });
      } else if (canonical === "Dispatch") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Fulfilment dispatch linked to Invoice ${invoice.invoiceNumber}`,
        });
      } else if (canonical === "Payment") {
        const details = parseDetailsJson(log.details);
        const relIds = Array.isArray(log.relatedEntities)
          ? (log.relatedEntities as Array<Record<string, unknown>>)
              .filter((r) => normalizeEntityName(String(r.entityType ?? "")) === "SalesInvoice")
              .map((r) => String(r.entityId ?? ""))
          : [];
        const detailInvId = typeof details.salesInvoiceId === "string" ? details.salesInvoiceId : null;
        const allocArr = Array.isArray(details.allocations)
          ? (details.allocations as Array<Record<string, unknown>>).map((a) =>
              String(a.salesInvoiceId ?? ""),
            )
          : [];
        const referencedInvoices = new Set([...relIds, ...allocArr, ...(detailInvId ? [detailInvId] : [])]);
        if (
          (log.action === "PAYMENT_ALLOCATED" || log.action === "PAYMENT_ALLOCATION_REVERSED") &&
          referencedInvoices.size > 0 &&
          !referencedInvoices.has(invoice.id)
        ) {
          continue;
        }

        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "IMPACT",
          relationshipLabel: `Payment allocated to Invoice ${invoice.invoiceNumber}`,
        });
      }
    }

    const baselines: TimelineEvent[] = [
      {
        id: `baseline:SalesInvoice:${invoice.id}:POST`,
        eventType: "INVOICE_POSTED",
        action: "POST",
        title: "Invoice issued",
        summary: `Invoice ${invoice.invoiceNumber} posted for ${formatMoneyValue(invoice.totalAmount)}`,
        category: "FINANCIAL",
        relationshipType: "DIRECT",
        relationshipLabel: `Direct event · Invoice ${invoice.invoiceNumber}`,
        originEntityType: "SalesInvoice",
        originEntityId: invoice.id,
        originEntityLabel: invoice.invoiceNumber,
        originRoute: buildRouteForEntity(user.role, "SalesInvoice", invoice.id),
        occurredAt: invoice.postedAt.toISOString(),
        recordedAt: invoice.postedAt.toISOString(),
        actorName: "System baseline",
        actorEmail: null,
        actorType: "SYSTEM",
        source: "RECORD_BASELINE",
        reason: null,
        correlationId: null,
        isBaseline: true,
        changes: [],
        relatedRecords: [],
        metadata: null,
      },
    ];

    return { label: invoice.invoiceNumber, candidates, baselines };
  }

  private async resolvePayment(
    organizationId: string,
    user: UserContext,
    paymentId: string,
    labelMap: Map<string, string>,
  ) {
    if (!hasRbacPermission(user.role, "payment", "read")) {
      throw new AppError("Forbidden: Insufficient permissions to view payment timeline", 403);
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      include: {
        customer: { select: { id: true, name: true } },
        allocations: {
          include: {
            salesInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                creditNotes: { select: { id: true, creditNoteNumber: true } },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(`Payment ${paymentId} not found`, 404);
    }

    labelMap.set(`Payment:${payment.id}`, payment.paymentNumber);
    labelMap.set(`Customer:${payment.customerId}`, payment.customer.name);

    const invoiceIds: string[] = [];
    const creditNoteIds: string[] = [];
    for (const alloc of payment.allocations) {
      invoiceIds.push(alloc.salesInvoiceId);
      labelMap.set(`SalesInvoice:${alloc.salesInvoiceId}`, alloc.salesInvoice.invoiceNumber);
      for (const cn of alloc.salesInvoice.creditNotes) {
        creditNoteIds.push(cn.id);
        labelMap.set(`CreditNote:${cn.id}`, cn.creditNoteNumber);
      }
    }

    const canReadInvoice = hasRbacPermission(user.role, "invoice", "read");
    const orClauses: Array<{ entity: { in: string[] }; entityId: { in: string[] } }> = [
      { entity: { in: ["Payment", "payment"] }, entityId: { in: [payment.id] } },
    ];
    if (canReadInvoice && invoiceIds.length > 0) {
      orClauses.push({ entity: { in: ["SalesInvoice"] }, entityId: { in: invoiceIds } });
    }
    if (canReadInvoice && creditNoteIds.length > 0) {
      orClauses.push({ entity: { in: ["CreditNote"] }, entityId: { in: creditNoteIds } });
    }

    const logs = await prisma.auditLog.findMany({
      where: { organizationId, OR: orClauses },
      orderBy: { timestamp: "desc" },
      take: 250,
    });

    const candidates: CandidateLog[] = [];
    for (const log of logs) {
      const canonical = normalizeEntityName(log.entity);
      if (canonical === "Payment") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "DIRECT",
          relationshipLabel: `Direct event · Payment ${payment.paymentNumber}`,
        });
      } else {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Allocated invoice · Payment ${payment.paymentNumber}`,
        });
      }
    }

    const baselines: TimelineEvent[] = [
      {
        id: `baseline:Payment:${payment.id}:CREATE`,
        eventType: "PAYMENT_RECORDED",
        action: "CREATE",
        title: "Payment recorded",
        summary: `Payment ${payment.paymentNumber} recorded for ${formatMoneyValue(payment.amount)}`,
        category: "FINANCIAL",
        relationshipType: "DIRECT",
        relationshipLabel: `Direct event · Payment ${payment.paymentNumber}`,
        originEntityType: "Payment",
        originEntityId: payment.id,
        originEntityLabel: payment.paymentNumber,
        originRoute: buildRouteForEntity(user.role, "Payment", payment.id),
        occurredAt: payment.postedAt.toISOString(),
        recordedAt: payment.createdAt.toISOString(),
        actorName: "System baseline",
        actorEmail: null,
        actorType: "SYSTEM",
        source: "RECORD_BASELINE",
        reason: null,
        correlationId: null,
        isBaseline: true,
        changes: [],
        relatedRecords: [],
        metadata: null,
      },
    ];

    return { label: payment.paymentNumber, candidates, baselines };
  }

  private async resolveCustomer(
    organizationId: string,
    user: UserContext,
    customerId: string,
    labelMap: Map<string, string>,
  ) {
    if (!hasRbacPermission(user.role, "customer", "read")) {
      throw new AppError("Forbidden: Insufficient permissions to view customer timeline", 403);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: {
        assignments: { select: { salesmanId: true } },
      },
    });

    if (!customer) {
      throw new AppError(`Customer ${customerId} not found`, 404);
    }

    if (
      user.role === "SALESMAN" &&
      !customer.assignments.some((a) => a.salesmanId === user.id)
    ) {
      throw new AppError("Forbidden: Customer is not assigned to you", 403);
    }

    labelMap.set(`Customer:${customer.id}`, customer.name);

    const canReadOrder = hasRbacPermission(user.role, "order", "read");
    const canReadInvoice = hasRbacPermission(user.role, "invoice", "read");
    const canReadPayment = hasRbacPermission(user.role, "payment", "read");

    const [orders, invoices, payments] = await Promise.all([
      canReadOrder
        ? prisma.salesOrder.findMany({
            where: {
              organizationId,
              customerId,
              ...(user.role === "SALESMAN" ? { salesmanId: user.id } : {}),
            },
            select: { id: true, orderNumber: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
      canReadInvoice
        ? prisma.salesInvoice.findMany({
            where: { organizationId, customerId },
            select: {
              id: true,
              invoiceNumber: true,
              postedAt: true,
              totalAmount: true,
              creditNotes: { select: { id: true, creditNoteNumber: true } },
            },
            orderBy: { postedAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
      canReadPayment
        ? prisma.payment.findMany({
            where: { organizationId, customerId },
            select: { id: true, paymentNumber: true, postedAt: true, amount: true },
            orderBy: { postedAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
    ]);

    for (const o of orders) labelMap.set(`SalesOrder:${o.id}`, o.orderNumber);
    for (const i of invoices) {
      labelMap.set(`SalesInvoice:${i.id}`, i.invoiceNumber);
      for (const cn of i.creditNotes) labelMap.set(`CreditNote:${cn.id}`, cn.creditNoteNumber);
    }
    for (const p of payments) labelMap.set(`Payment:${p.id}`, p.paymentNumber);

    const orderIds = orders.map((o) => o.id);
    const invoiceIds = invoices.map((i) => i.id);
    const creditNoteIds = invoices.flatMap((i) => i.creditNotes.map((c) => c.id));
    const paymentIds = payments.map((p) => p.id);

    const orClauses: Array<{ entity: { in: string[] }; entityId: { in: string[] } }> = [
      { entity: { in: ["Customer"] }, entityId: { in: [customer.id] } },
    ];
    if (orderIds.length > 0) {
      orClauses.push({ entity: { in: ["SalesOrder"] }, entityId: { in: orderIds } });
    }
    if (invoiceIds.length > 0) {
      orClauses.push({ entity: { in: ["SalesInvoice"] }, entityId: { in: invoiceIds } });
    }
    if (creditNoteIds.length > 0) {
      orClauses.push({ entity: { in: ["CreditNote"] }, entityId: { in: creditNoteIds } });
    }
    if (paymentIds.length > 0) {
      orClauses.push({ entity: { in: ["Payment", "payment"] }, entityId: { in: paymentIds } });
    }

    const logs = await prisma.auditLog.findMany({
      where: { organizationId, OR: orClauses },
      orderBy: { timestamp: "desc" },
      take: 300,
    });

    const candidates: CandidateLog[] = logs.map((log) => {
      const canonical = normalizeEntityName(log.entity);
      if (canonical === "Customer") {
        return {
          log,
          canonicalEntity: canonical,
          relationshipType: "DIRECT",
          relationshipLabel: `Account profile · ${customer.name}`,
        };
      }
      return {
        log,
        canonicalEntity: canonical,
        relationshipType: "RELATED",
        relationshipLabel: `Commercial activity · ${customer.name}`,
      };
    });

    const baselines: TimelineEvent[] = [
      {
        id: `baseline:Customer:${customer.id}:CREATE`,
        eventType: "CUSTOMER_CREATED",
        action: "CREATE",
        title: "Customer account created",
        summary: `Customer ${customer.name} (${customer.code}) onboarded`,
        category: "DIRECT",
        relationshipType: "DIRECT",
        relationshipLabel: `Account profile · ${customer.name}`,
        originEntityType: "Customer",
        originEntityId: customer.id,
        originEntityLabel: customer.name,
        originRoute: buildRouteForEntity(user.role, "Customer", customer.id),
        occurredAt: customer.createdAt.toISOString(),
        recordedAt: customer.createdAt.toISOString(),
        actorName: "System baseline",
        actorEmail: null,
        actorType: "SYSTEM",
        source: "RECORD_BASELINE",
        reason: null,
        correlationId: null,
        isBaseline: true,
        changes: [],
        relatedRecords: [],
        metadata: null,
      },
    ];

    return { label: customer.name, candidates, baselines };
  }

  private async resolveProduct(
    organizationId: string,
    user: UserContext,
    productId: string,
    labelMap: Map<string, string>,
  ) {
    if (!hasRbacPermission(user.role, "inventory", "read")) {
      throw new AppError("Forbidden: Insufficient permissions to view product timeline", 403);
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: {
        variants: {
          include: {
            recipes: { select: { id: true, name: true, version: true } },
            priceLines: { select: { id: true } },
          },
        },
      },
    });

    if (!product) {
      throw new AppError(`Product ${productId} not found`, 404);
    }

    labelMap.set(`Product:${product.id}`, product.name);
    const variantIds: string[] = [];
    const recipeIds: string[] = [];
    const priceLineIds: string[] = [];

    for (const v of product.variants) {
      variantIds.push(v.id);
      labelMap.set(`ProductVariant:${v.id}`, `${v.name} (${v.sku})`);
      for (const r of v.recipes) {
        recipeIds.push(r.id);
        labelMap.set(`Recipe:${r.id}`, `${r.name} (v${r.version})`);
      }
      for (const pl of v.priceLines) {
        priceLineIds.push(pl.id);
      }
    }

    const canReadOrder = hasRbacPermission(user.role, "order", "read");
    const canReadInvoice = hasRbacPermission(user.role, "invoice", "read");
    const canReadProd = hasRbacPermission(user.role, "production_run", "read");

    const [orderLines, invoiceLines, prodRuns] = await Promise.all([
      canReadOrder && variantIds.length > 0
        ? prisma.salesOrderLine.findMany({
            where: {
              productVariantId: { in: variantIds },
              salesOrder: {
                organizationId,
                ...(user.role === "SALESMAN" ? { salesmanId: user.id } : {}),
              },
            },
            select: {
              salesOrder: { select: { id: true, orderNumber: true } },
            },
            take: 100,
          })
        : Promise.resolve([]),
      canReadInvoice && variantIds.length > 0
        ? prisma.salesInvoiceLine.findMany({
            where: {
              productVariantId: { in: variantIds },
              salesInvoice: { organizationId },
            },
            select: {
              salesInvoice: { select: { id: true, invoiceNumber: true } },
            },
            take: 100,
          })
        : Promise.resolve([]),
      canReadProd && recipeIds.length > 0
        ? prisma.productionRun.findMany({
            where: { organizationId, recipeId: { in: recipeIds } },
            select: { id: true, runNumber: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
    ]);

    const orderIds = Array.from(new Set(orderLines.map((l) => l.salesOrder.id)));
    for (const l of orderLines) labelMap.set(`SalesOrder:${l.salesOrder.id}`, l.salesOrder.orderNumber);

    const invoiceIds = Array.from(new Set(invoiceLines.map((l) => l.salesInvoice.id)));
    for (const l of invoiceLines) {
      labelMap.set(`SalesInvoice:${l.salesInvoice.id}`, l.salesInvoice.invoiceNumber);
    }

    const runIds = prodRuns.map((r) => r.id);
    for (const r of prodRuns) labelMap.set(`ProductionRun:${r.id}`, r.runNumber);

    const orClauses: Array<{ entity: { in: string[] }; entityId: { in: string[] } }> = [
      { entity: { in: ["Product"] }, entityId: { in: [product.id] } },
      ...(variantIds.length > 0
        ? [{ entity: { in: ["ProductVariant"] }, entityId: { in: variantIds } }]
        : []),
      ...(priceLineIds.length > 0
        ? [{ entity: { in: ["PriceListLine"] }, entityId: { in: priceLineIds } }]
        : []),
      ...(recipeIds.length > 0 && canReadProd
        ? [{ entity: { in: ["Recipe"] }, entityId: { in: recipeIds } }]
        : []),
      ...(runIds.length > 0
        ? [{ entity: { in: ["ProductionRun"] }, entityId: { in: runIds } }]
        : []),
      ...(orderIds.length > 0
        ? [{ entity: { in: ["SalesOrder"] }, entityId: { in: orderIds } }]
        : []),
      ...(invoiceIds.length > 0
        ? [{ entity: { in: ["SalesInvoice"] }, entityId: { in: invoiceIds } }]
        : []),
    ];

    const logs = await prisma.auditLog.findMany({
      where: { organizationId, OR: orClauses },
      orderBy: { timestamp: "desc" },
      take: 300,
    });

    const candidates: CandidateLog[] = [];
    for (const log of logs) {
      const canonical = normalizeEntityName(log.entity);
      if (canonical === "Product" || canonical === "ProductVariant") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "DIRECT",
          relationshipLabel: `Master data · ${product.name}`,
        });
      } else if (canonical === "PriceListLine") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "DIRECT",
          relationshipLabel: `Pricing update · ${product.name}`,
        });
      } else if (canonical === "Recipe") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Recipe / BOM for ${product.name}`,
        });
      } else if (canonical === "ProductionRun") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "IMPACT",
          relationshipLabel: `Production batch for ${product.name}`,
        });
      } else {
        // For Orders, only include meaningful lifecycle events (CREATE, APPROVE, REJECT)
        if (canonical === "SalesOrder" && log.action === "UPDATE") continue;
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Commercial transaction involving ${product.name}`,
        });
      }
    }

    const baselines: TimelineEvent[] = [
      {
        id: `baseline:Product:${product.id}:CREATE`,
        eventType: "PRODUCT_CREATED",
        action: "CREATE",
        title: "Product created",
        summary: `Product ${product.name} (${product.code}) created`,
        category: "DIRECT",
        relationshipType: "DIRECT",
        relationshipLabel: `Master data · ${product.name}`,
        originEntityType: "Product",
        originEntityId: product.id,
        originEntityLabel: product.name,
        originRoute: buildRouteForEntity(user.role, "Product", product.id),
        occurredAt: product.createdAt.toISOString(),
        recordedAt: product.createdAt.toISOString(),
        actorName: "System baseline",
        actorEmail: null,
        actorType: "SYSTEM",
        source: "RECORD_BASELINE",
        reason: null,
        correlationId: null,
        isBaseline: true,
        changes: [],
        relatedRecords: [],
        metadata: null,
      },
    ];

    return { label: product.name, candidates, baselines };
  }

  private async resolveRecipe(
    organizationId: string,
    user: UserContext,
    recipeId: string,
    labelMap: Map<string, string>,
  ) {
    if (!hasRbacPermission(user.role, "production_run", "read")) {
      throw new AppError("Forbidden: Insufficient permissions to view recipe timeline", 403);
    }

    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, organizationId },
      include: {
        productVariant: {
          include: {
            product: { select: { id: true, name: true, code: true } },
            recipes: { select: { id: true, name: true, version: true } },
          },
        },
        productionRuns: {
          select: { id: true, runNumber: true, recipeVersion: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!recipe) {
      throw new AppError(`Recipe ${recipeId} not found`, 404);
    }

    const recipeLabel = `${recipe.name} (v${recipe.version})`;
    labelMap.set(`Recipe:${recipe.id}`, recipeLabel);
    labelMap.set(`Product:${recipe.productVariant.product.id}`, recipe.productVariant.product.name);
    labelMap.set(`ProductVariant:${recipe.productVariant.id}`, recipe.productVariant.sku);

    const siblingRecipeIds = recipe.productVariant.recipes
      .filter((r) => r.id !== recipe.id)
      .map((r) => {
        labelMap.set(`Recipe:${r.id}`, `${r.name} (v${r.version})`);
        return r.id;
      });
    const runIds = recipe.productionRuns.map((r) => {
      labelMap.set(`ProductionRun:${r.id}`, r.runNumber);
      return r.id;
    });

    const orClauses: Array<{ entity: { in: string[] }; entityId: { in: string[] } }> = [
      { entity: { in: ["Recipe"] }, entityId: { in: [recipe.id, ...siblingRecipeIds] } },
      { entity: { in: ["Product"] }, entityId: { in: [recipe.productVariant.product.id] } },
      ...(runIds.length > 0
        ? [{ entity: { in: ["ProductionRun"] }, entityId: { in: runIds } }]
        : []),
    ];

    const logs = await prisma.auditLog.findMany({
      where: { organizationId, OR: orClauses },
      orderBy: { timestamp: "desc" },
      take: 250,
    });

    const candidates: CandidateLog[] = [];
    for (const log of logs) {
      const canonical = normalizeEntityName(log.entity);
      if (canonical === "Recipe" && log.entityId === recipe.id) {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "DIRECT",
          relationshipLabel: `Direct event · ${recipeLabel}`,
        });
      } else if (canonical === "Recipe") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Sibling revision · ${recipe.productVariant.sku}`,
        });
      } else if (canonical === "ProductionRun") {
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "IMPACT",
          relationshipLabel: `Production batch using v${recipe.version}`,
        });
      } else if (canonical === "Product") {
        if (!["CREATE", "ARCHIVE", "RESTORE"].includes(log.action.toUpperCase())) continue;
        candidates.push({
          log,
          canonicalEntity: canonical,
          relationshipType: "RELATED",
          relationshipLabel: `Output product · ${recipe.productVariant.product.name}`,
        });
      }
    }

    const baselines: TimelineEvent[] = [
      {
        id: `baseline:Recipe:${recipe.id}:CREATE`,
        eventType: "RECIPE_CREATED",
        action: "CREATE",
        title: "Recipe revision created",
        summary: `Recipe ${recipeLabel} created for ${recipe.productVariant.name}`,
        category: "DIRECT",
        relationshipType: "DIRECT",
        relationshipLabel: `Direct event · ${recipeLabel}`,
        originEntityType: "Recipe",
        originEntityId: recipe.id,
        originEntityLabel: recipeLabel,
        originRoute: buildRouteForEntity(user.role, "Recipe", recipe.id),
        occurredAt: recipe.createdAt.toISOString(),
        recordedAt: recipe.createdAt.toISOString(),
        actorName: "System baseline",
        actorEmail: null,
        actorType: "SYSTEM",
        source: "RECORD_BASELINE",
        reason: null,
        correlationId: null,
        isBaseline: true,
        changes: [],
        relatedRecords: [],
        metadata: null,
      },
    ];

    return { label: recipeLabel, candidates, baselines };
  }
}

export const timelineService = new TimelineService();

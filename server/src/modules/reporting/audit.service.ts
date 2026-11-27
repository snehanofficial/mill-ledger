import { prisma } from "../../db/client.js";
import type { Prisma } from "@prisma/client";
import {
  buildPaginationMeta,
  normalizePaginationOptions,
} from "../../utils/pagination.js";

export interface AuditChangeInput {
  field: string;
  label?: string;
  kind?: "added" | "removed" | "changed";
  previousValue?: unknown;
  newValue?: unknown;
}

export interface AuditRelatedEntityInput {
  entityType: string;
  entityId: string;
  label?: string;
  role?: string;
}

export interface LogAuditInput {
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  actorName?: string;
  actorType?: "USER" | "SYSTEM" | "OFFLINE_SYNC";
  source?: "API" | "OFFLINE_SYNC" | "SYSTEM" | "SEED";
  action: string;
  eventType?: string;
  entity: string;
  entityId?: string;
  summary?: string;
  details?: string | Record<string, unknown>;
  changes?: AuditChangeInput[];
  relatedEntities?: AuditRelatedEntityInput[];
  reason?: string;
  requestId?: string;
  correlationId?: string;
  ipAddress?: string;
  occurredAt?: Date;
}

export class AuditService {
  private async resolveOrgId(
    orgIdOrCode?: string,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<string> {
    const target = orgIdOrCode || "MILL";
    const org = await db.organization.findFirst({
      where: {
        OR: [{ id: target }, { code: target }],
      },
      select: { id: true },
    });
    return org ? org.id : target;
  }

  /**
   * Log an audit event, optionally inside an existing Prisma transaction.
   */
  async log(input: LogAuditInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    try {
      const organizationId = await this.resolveOrgId(input.organizationId, db);
      const detailsStr =
        typeof input.details === "object" && input.details !== null
          ? JSON.stringify(input.details)
          : input.details;

      const correlationId = input.correlationId ?? input.requestId;

      return await db.auditLog.create({
        data: {
          organizationId,
          userId: input.userId,
          userEmail: input.userEmail,
          actorName: input.actorName ?? (input.userEmail ? input.userEmail.split("@")[0] : undefined),
          actorType: input.actorType ?? "USER",
          source: input.source ?? "API",
          action: input.action,
          eventType: input.eventType ?? `${input.entity.toUpperCase()}_${input.action.toUpperCase()}`,
          entity: input.entity,
          entityId: input.entityId,
          summary: input.summary,
          details: detailsStr,
          changes: input.changes
            ? (input.changes as unknown as Prisma.InputJsonValue)
            : undefined,
          relatedEntities: input.relatedEntities
            ? (input.relatedEntities as unknown as Prisma.InputJsonValue)
            : undefined,
          reason: input.reason,
          requestId: input.requestId,
          correlationId,
          ipAddress: input.ipAddress,
          schemaVersion: 1,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
    } catch (err) {
      if (tx) {
        throw err;
      }
      console.error("Failed to write audit log:", err);
      return null;
    }
  }

  /**
   * Query audit logs
   */
  async getLogs(params: {
    organizationId?: string;
    entity?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const where: Prisma.AuditLogWhereInput = {
      organizationId: orgId,
    };

    if (params.entity) {
      where.entity = params.entity;
    }
    if (params.action) {
      where.action = params.action;
    }
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) {
        where.timestamp.gte = params.startDate;
      }
      if (params.endDate) {
        where.timestamp.lte = params.endDate;
      }
    }

    return await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: params.limit || 100,
    });
  }

  async getLogsPaginated(params: {
    organizationId?: string;
    entity?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    page?: number;
  }) {
    const orgId = await this.resolveOrgId(params.organizationId);
    const where: Prisma.AuditLogWhereInput = {
      organizationId: orgId,
    };

    if (params.entity) {
      where.entity = params.entity;
    }
    if (params.action) {
      where.action = params.action;
    }
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) {
        where.timestamp.gte = params.startDate;
      }
      if (params.endDate) {
        where.timestamp.lte = params.endDate;
      }
    }

    const { limit, offset } = normalizePaginationOptions(params, {
      limit: 50,
      maxLimit: 100,
    });

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: buildPaginationMeta(limit, offset, logs.length, total),
    };
  }
}

export const auditService = new AuditService();

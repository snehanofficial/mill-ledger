import { prisma } from "../../db/client.js";

export interface LogAuditInput {
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
  reason?: string;
  requestId?: string;
  ipAddress?: string;
}

export class AuditService {
  private async resolveOrgId(orgIdOrCode?: string): Promise<string> {
    const target = orgIdOrCode || "MILL";
    const org = await prisma.organization.findFirst({
      where: {
        OR: [{ id: target }, { code: target }],
      },
    });
    return org ? org.id : target;
  }

  /**
   * Log an audit event
   */
  async log(input: LogAuditInput) {
    try {
      const organizationId = await this.resolveOrgId(input.organizationId);
      const detailsStr =
        typeof input.details === "object"
          ? JSON.stringify(input.details)
          : input.details;

      return await prisma.auditLog.create({
        data: {
          organizationId,
          userId: input.userId,
          userEmail: input.userEmail,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          details: detailsStr,
          reason: input.reason,
          requestId: input.requestId,
          ipAddress: input.ipAddress,
        },
      });
    } catch (err) {
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

    const where: any = {
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
}

export const auditService = new AuditService();

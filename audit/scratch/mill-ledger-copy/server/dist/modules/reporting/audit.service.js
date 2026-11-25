import { prisma } from "../../db/client.js";
export class AuditService {
    async resolveOrgId(orgIdOrCode) {
        if (!orgIdOrCode)
            return "MILL";
        const org = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgIdOrCode }, { code: orgIdOrCode }],
            },
        });
        return org ? org.id : orgIdOrCode;
    }
    /**
     * Log an audit event
     */
    async log(input) {
        try {
            const organizationId = await this.resolveOrgId(input.organizationId);
            const detailsStr = typeof input.details === "object"
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
        }
        catch (err) {
            console.error("Failed to write audit log:", err);
            return null;
        }
    }
    /**
     * Query audit logs
     */
    async getLogs(params) {
        const orgId = await this.resolveOrgId(params.organizationId);
        const where = {
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

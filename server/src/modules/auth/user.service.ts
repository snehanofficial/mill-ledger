import { prisma } from "../../db/client.js";
import { auth } from "../../lib/auth.js";
import { AppError } from "../../middleware/error.middleware.js";
import { auditService } from "../reporting/audit.service.js";
import type { Role } from "@mill-ledger/shared";
import {
  buildPaginationMeta,
  normalizePaginationOptions,
} from "../../utils/pagination.js";

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
  organizationId?: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  isActive?: boolean;
  organizationId?: string;
}

export interface UserFilter {
  organizationId?: string;
  role?: string;
  isActive?: boolean;
}

export class UserService {
  /**
   * List users matching optional filter
   */
  async getUsers(filter?: UserFilter) {
    const where: Record<string, unknown> = {};
    if (filter?.organizationId) {
      where.organizationId = filter.organizationId;
    }
    if (filter?.role) {
      where.role = filter.role;
    }
    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return users;
  }

  async getUsersPaginated(
    filter?: UserFilter & {
      q?: string;
      limit?: number;
      offset?: number;
      page?: number;
    },
  ) {
    const where: Record<string, unknown> = {};
    if (filter?.organizationId) {
      where.organizationId = filter.organizationId;
    }
    if (filter?.role) {
      where.role = filter.role;
    }
    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter?.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const { limit, offset } = normalizePaginationOptions(filter, {
      limit: 50,
      maxLimit: 100,
    });

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: buildPaginationMeta(limit, offset, users.length, total),
    };
  }

  /**
   * Get single user by ID (scoped to organization when provided)
   */
  async getUserById(id: string, organizationId?: string) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(`User ${id} not found`, 404);
    }

    return user;
  }

  /**
   * Create a new user with secure password hashing via Better Auth
   */
  async createUser(input: CreateUserInput) {
    if (!input.name || input.name.trim().length === 0) {
      throw new AppError("User name is required", 400);
    }
    if (!input.email || !input.email.includes("@")) {
      throw new AppError("Valid email is required", 400);
    }
    if (!input.password || input.password.length < 8) {
      throw new AppError("Password must be at least 8 characters", 400);
    }

    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new AppError(`User with email ${input.email} already exists`, 409);
    }

    const role = input.role || "SALESMAN";
    const validRoles: Role[] = ["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"];
    if (!validRoles.includes(role)) {
      throw new AppError(`Invalid role: ${role}`, 400);
    }

    if (!input.organizationId) {
      throw new AppError("Organization context is required to create user", 400);
    }
    const org = await prisma.organization.findFirst({
      where: { OR: [{ id: input.organizationId }, { code: input.organizationId }] },
      select: { id: true },
    });
    if (!org) {
      throw new AppError(`Organization ${input.organizationId} not found`, 404);
    }

    // Provision credentialed account via Better Auth
    await auth.api.signUpEmail({
      body: {
        email: input.email.toLowerCase().trim(),
        password: input.password,
        name: input.name.trim(),
      },
    });

    // Update with application metadata (role, organization, active status)
    const updated = await prisma.user.update({
      where: { email: input.email.toLowerCase().trim() },
      data: {
        role,
        isActive: true,
        organizationId: org.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log user creation
    await auditService.log({
      organizationId: updated.organizationId ?? undefined,
      userId: updated.id,
      userEmail: updated.email,
      action: "USER_CREATE",
      entity: "User",
      entityId: updated.id,
      details: { role: updated.role, name: updated.name },
    });

    return updated;
  }

  /**
   * Update an existing user, enforcing the Last-Admin Demotion/Deactivation safeguard per organization
   */
  async updateUser(id: string, input: UpdateUserInput, organizationId?: string) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (!user) {
      throw new AppError(`User ${id} not found`, 404);
    }

    if (input.role) {
      const validRoles: Role[] = ["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"];
      if (!validRoles.includes(input.role)) {
        throw new AppError(`Invalid role: ${input.role}`, 400);
      }
    }

    // Safeguard: Protect the last remaining active administrator in the organization from demotion or deactivation
    const isCurrentlyActiveAdmin = user.role === "ADMIN" && user.isActive;
    const isDemoting = input.role !== undefined && input.role !== "ADMIN";
    const isDeactivating = input.isActive === false;

    if (isCurrentlyActiveAdmin && (isDemoting || isDeactivating)) {
      const activeAdminCount = await prisma.user.count({
        where: {
          role: "ADMIN",
          isActive: true,
          organizationId: user.organizationId,
          id: { not: id },
        },
      });

      if (activeAdminCount === 0) {
        throw new AppError(
          "Cannot demote or deactivate the last remaining administrator account",
          400,
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        role: input.role,
        isActive: input.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Invalidate all active sessions immediately when a user is deactivated or role changes
    if (input.isActive === false || (input.role !== undefined && input.role !== user.role)) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    // Audit log user update
    await auditService.log({
      organizationId: updated.organizationId ?? undefined,
      action: "USER_UPDATE",
      entity: "User",
      entityId: updated.id,
      details: { ...input },
    });

    return updated;
  }

  /**
   * Delete user account, enforcing Last-Admin deletion safeguard per organization and operational integrity
   */
  async deleteUser(id: string, organizationId?: string) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (!user) {
      throw new AppError(`User ${id} not found`, 404);
    }

    // Safeguard: Protect the last remaining active administrator in the organization from deletion
    if (user.role === "ADMIN" && user.isActive) {
      const activeAdminCount = await prisma.user.count({
        where: {
          role: "ADMIN",
          isActive: true,
          organizationId: user.organizationId,
          id: { not: id },
        },
      });

      if (activeAdminCount === 0) {
        throw new AppError(
          "Cannot delete the last remaining administrator account",
          400,
        );
      }
    }

    // Verify user has no referenced operational records before hard deletion
    const orderCount = await prisma.salesOrder.count({
      where: { salesmanId: id },
    });

    if (orderCount > 0) {
      throw new AppError(
        "Cannot delete user with existing operational records; deactivate the account instead",
        400,
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    // Audit log user deletion
    await auditService.log({
      organizationId: user.organizationId ?? undefined,
      action: "USER_DELETE",
      entity: "User",
      entityId: user.id,
      details: { email: user.email, role: user.role },
    });

    return { success: true, id };
  }

  /**
   * Automated Session & Token Cleanup Procedure (DPDP Act 2023 - Data Minimization)
   * Purges expired sessions and sessions older than 90 days.
   */
  async cleanupExpiredSessions() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { createdAt: { lt: ninetyDaysAgo } },
        ],
      },
    });

    return {
      deletedCount: result.count,
      purgedAt: now.toISOString(),
    };
  }
}

export const userService = new UserService();

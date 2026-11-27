import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/error.middleware.js";
import type { UserContext } from "@mill-ledger/shared";
import { auditService } from "../reporting/audit.service.js";

export class MastersService {
  private async resolveOrgId(orgCodeOrId = "MILL"): Promise<string> {
    const org = await prisma.organization.findFirst({
      where: {
        OR: [{ id: orgCodeOrId }, { code: orgCodeOrId }],
      },
    });
    if (!org) {
      throw new AppError(`Organization ${orgCodeOrId} not found`, 404);
    }
    return org.id;
  }

  async getProductsMaster(organizationId = "MILL") {
    const orgId = await this.resolveOrgId(organizationId);
    const [products, uoms, finishedGoodsItems, priceLists] = await Promise.all([
      prisma.product.findMany({
        where: { organizationId: orgId },
        include: {
          variants: {
            include: {
              uom: true,
              inventoryItem: true,
              priceLines: {
                include: { priceList: true },
              },
            },
            orderBy: { sku: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.unitOfMeasure.findMany({
        where: { organizationId: orgId },
        orderBy: { code: "asc" },
      }),
      prisma.inventoryItem.findMany({
        where: { organizationId: orgId, category: "FINISHED_GOODS" },
        orderBy: { name: "asc" },
      }),
      prisma.priceList.findMany({
        where: { organizationId: orgId },
        include: {
          lines: {
            include: {
              productVariant: {
                include: { product: true },
              },
            },
          },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
    ]);

    return { products, uoms, finishedGoodsItems, priceLists };
  }

  async createProduct(
    input: {
      organizationId?: string;
      code: string;
      name: string;
      hsnCode?: string;
      taxRate?: number;
    },
    user: UserContext,
  ) {
    const orgId = await this.resolveOrgId(input.organizationId);
    const existing = await prisma.product.findUnique({
      where: {
        organizationId_code: { organizationId: orgId, code: input.code.trim() },
      },
    });
    if (existing) {
      throw new AppError(`Product code ${input.code} already exists`, 409);
    }

    const product = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        hsnCode: input.hsnCode?.trim() || "21069099",
        taxRate: input.taxRate ?? 5.0,
      },
      include: { variants: true },
    });

    await auditService.log({
      organizationId: orgId,
      userId: user.id,
      userEmail: user.email,
      action: "CREATE",
      entity: "Product",
      entityId: product.id,
      details: { code: product.code, name: product.name, hsnCode: product.hsnCode },
    });

    return product;
  }

  async updateProduct(
    id: string,
    input: {
      name?: string;
      hsnCode?: string;
      taxRate?: number;
      isActive?: boolean;
    },
    user: UserContext,
  ) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Product ${id} not found`, 404);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        hsnCode: input.hsnCode !== undefined ? input.hsnCode.trim() : undefined,
        taxRate: input.taxRate !== undefined ? input.taxRate : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
      include: { variants: true },
    });

    await auditService.log({
      organizationId: existing.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "Product",
      entityId: updated.id,
      details: { name: updated.name, isActive: updated.isActive },
    });

    return updated;
  }

  async createVariant(
    input: {
      productId: string;
      sku: string;
      name: string;
      packSize: number;
      uomId: string;
      inventoryItemId?: string | null;
      defaultPrice?: number;
    },
    user: UserContext,
  ) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) {
      throw new AppError(`Product ${input.productId} not found`, 404);
    }
    if (input.packSize <= 0) {
      throw new AppError("Pack size must be greater than zero", 400);
    }

    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: input.sku.trim().toUpperCase(),
          name: input.name.trim(),
          packSize: input.packSize,
          uomId: input.uomId,
          inventoryItemId: input.inventoryItemId || null,
        },
        include: { uom: true, inventoryItem: true },
      });

      if (input.defaultPrice !== undefined && input.defaultPrice >= 0) {
        const defaultList = await tx.priceList.findFirst({
          where: { organizationId: product.organizationId, isDefault: true },
        });
        if (defaultList) {
          await tx.priceListLine.upsert({
            where: {
              priceListId_productVariantId: {
                priceListId: defaultList.id,
                productVariantId: created.id,
              },
            },
            update: { price: input.defaultPrice },
            create: {
              priceListId: defaultList.id,
              productVariantId: created.id,
              price: input.defaultPrice,
            },
          });
        }
      }

      return created;
    });

    await auditService.log({
      organizationId: product.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "CREATE",
      entity: "ProductVariant",
      entityId: variant.id,
      details: { sku: variant.sku, name: variant.name, packSize: input.packSize },
    });

    return variant;
  }

  async updateVariant(
    id: string,
    input: {
      name?: string;
      packSize?: number;
      uomId?: string;
      inventoryItemId?: string | null;
      isActive?: boolean;
    },
    user: UserContext,
  ) {
    const existing = await prisma.productVariant.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!existing) {
      throw new AppError(`Product variant ${id} not found`, 404);
    }
    if (input.packSize !== undefined && input.packSize <= 0) {
      throw new AppError("Pack size must be greater than zero", 400);
    }

    const updated = await prisma.productVariant.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        packSize: input.packSize !== undefined ? input.packSize : undefined,
        uomId: input.uomId !== undefined ? input.uomId : undefined,
        inventoryItemId:
          input.inventoryItemId !== undefined
            ? input.inventoryItemId || null
            : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
      include: { uom: true, inventoryItem: true },
    });

    await auditService.log({
      organizationId: existing.product.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "ProductVariant",
      entityId: updated.id,
      details: { sku: updated.sku, isActive: updated.isActive },
    });

    return updated;
  }

  async deleteVariant(id: string, user: UserContext) {
    const existing = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
        _count: {
          select: { salesOrderLines: true, recipes: true },
        },
      },
    });
    if (!existing) {
      throw new AppError(`Product variant ${id} not found`, 404);
    }
    if (existing._count.salesOrderLines > 0 || existing._count.recipes > 0) {
      throw new AppError(
        "Cannot delete variant referenced by sales orders or BOM recipes. Archive it instead.",
        400,
      );
    }

    await prisma.productVariant.delete({ where: { id } });

    await auditService.log({
      organizationId: existing.product.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "DELETE",
      entity: "ProductVariant",
      entityId: id,
      details: { sku: existing.sku },
    });

    return { deleted: true, id };
  }

  async createPriceList(
    input: {
      organizationId?: string;
      code: string;
      name: string;
      isDefault?: boolean;
    },
    user: UserContext,
  ) {
    const orgId = await this.resolveOrgId(input.organizationId);
    const priceList = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.priceList.updateMany({
          where: { organizationId: orgId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return await tx.priceList.create({
        data: {
          organizationId: orgId,
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          isDefault: Boolean(input.isDefault),
        },
      });
    });

    await auditService.log({
      organizationId: orgId,
      userId: user.id,
      userEmail: user.email,
      action: "CREATE",
      entity: "PriceList",
      entityId: priceList.id,
      details: { code: priceList.code, name: priceList.name },
    });

    return priceList;
  }

  async upsertPriceListLine(
    priceListId: string,
    input: { productVariantId: string; price: number },
    user: UserContext,
  ) {
    const priceList = await prisma.priceList.findUnique({
      where: { id: priceListId },
    });
    if (!priceList) {
      throw new AppError(`Price list ${priceListId} not found`, 404);
    }
    if (input.price < 0) {
      throw new AppError("Price cannot be negative", 400);
    }

    const line = await prisma.priceListLine.upsert({
      where: {
        priceListId_productVariantId: {
          priceListId,
          productVariantId: input.productVariantId,
        },
      },
      update: { price: input.price },
      create: {
        priceListId,
        productVariantId: input.productVariantId,
        price: input.price,
      },
      include: { productVariant: true },
    });

    await auditService.log({
      organizationId: priceList.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "UPSERT_PRICE",
      entity: "PriceListLine",
      entityId: line.id,
      details: {
        priceListCode: priceList.code,
        variantSku: line.productVariant.sku,
        price: input.price,
      },
    });

    return line;
  }

  async getOrganization(organizationId = "MILL") {
    const orgId = await this.resolveOrgId(organizationId);
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError("Organization not found", 404);
    return org;
  }

  async updateOrganization(
    organizationId: string,
    input: { name?: string; state?: string; gstin?: string | null },
    user: UserContext,
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        state: input.state !== undefined ? input.state.trim() : undefined,
        gstin:
          input.gstin !== undefined
            ? input.gstin
              ? input.gstin.trim().toUpperCase()
              : null
            : undefined,
      },
    });
    await auditService.log({
      organizationId: orgId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "Organization",
      entityId: orgId,
      details: { name: updated.name, state: updated.state, gstin: updated.gstin },
    });
    return updated;
  }

  // ─── Facilities & Warehouses ────────────────────────────────────────

  async getFacilities(organizationId: string, includeInactive = false) {
    const orgId = await this.resolveOrgId(organizationId);
    return prisma.facility.findMany({
      where: {
        organizationId: orgId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: { warehouses: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
  }

  async getFacilityById(id: string, organizationId: string) {
    const orgId = await this.resolveOrgId(organizationId);
    const facility = await prisma.facility.findFirst({
      where: { id, organizationId: orgId },
      include: {
        warehouses: {
          orderBy: { code: "asc" },
        },
      },
    });
    if (!facility) {
      throw new AppError(`Facility ${id} not found`, 404);
    }
    return facility;
  }

  async createFacility(
    organizationId: string,
    input: { code: string; name: string; state?: string },
    user: UserContext,
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const code = input.code.trim().toUpperCase();
    const existing = await prisma.facility.findUnique({
      where: { organizationId_code: { organizationId: orgId, code } },
    });
    if (existing) {
      throw new AppError(`Facility with code ${code} already exists`, 409);
    }

    const facility = await prisma.facility.create({
      data: {
        organizationId: orgId,
        code,
        name: input.name.trim(),
        state: (input.state || "Tamil Nadu").trim(),
        isActive: true,
      },
    });

    await auditService.log({
      organizationId: orgId,
      userId: user.id,
      userEmail: user.email,
      action: "CREATE",
      entity: "Facility",
      entityId: facility.id,
      details: { code: facility.code, name: facility.name, state: facility.state },
    });

    return facility;
  }

  async updateFacility(
    id: string,
    organizationId: string,
    input: { name?: string; state?: string; isActive?: boolean },
    user: UserContext,
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const facility = await prisma.facility.findFirst({
      where: { id, organizationId: orgId },
      include: { warehouses: true },
    });
    if (!facility) {
      throw new AppError(`Facility ${id} not found`, 404);
    }

    if (input.isActive === false && facility.isActive) {
      const hasActiveWarehouses = facility.warehouses.some((w) => w.isActive);
      if (hasActiveWarehouses) {
        throw new AppError(
          "Cannot deactivate facility with active warehouses; deactivate its warehouses first",
          409,
        );
      }
    }

    const updated = await prisma.facility.update({
      where: { id: facility.id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        state: input.state !== undefined ? input.state.trim() : undefined,
        isActive: input.isActive,
      },
    });

    await auditService.log({
      organizationId: orgId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "Facility",
      entityId: updated.id,
      details: {
        name: updated.name,
        state: updated.state,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async getWarehouses(
    organizationId: string,
    options?: { facilityId?: string; includeInactive?: boolean },
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    return prisma.warehouse.findMany({
      where: {
        organizationId: orgId,
        ...(options?.facilityId ? { facilityId: options.facilityId } : {}),
        ...(options?.includeInactive ? {} : { isActive: true }),
      },
      include: {
        facility: {
          select: { id: true, code: true, name: true, state: true, isActive: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
  }

  async getWarehouseById(id: string, organizationId: string) {
    const orgId = await this.resolveOrgId(organizationId);
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, organizationId: orgId },
      include: {
        facility: true,
        warehouseStockBalances: {
          include: {
            inventoryItem: {
              include: { baseUom: true },
            },
          },
          orderBy: { inventoryItem: { name: "asc" } },
        },
      },
    });
    if (!warehouse) {
      throw new AppError(`Warehouse ${id} not found`, 404);
    }
    return warehouse;
  }

  async createWarehouse(
    organizationId: string,
    input: { facilityId: string; code: string; name: string },
    user: UserContext,
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const facility = await prisma.facility.findFirst({
      where: { id: input.facilityId, organizationId: orgId },
    });
    if (!facility) {
      throw new AppError(`Facility ${input.facilityId} not found`, 404);
    }
    if (!facility.isActive) {
      throw new AppError(
        "Cannot create warehouse under an inactive facility",
        400,
      );
    }

    const code = input.code.trim().toUpperCase();
    const existing = await prisma.warehouse.findUnique({
      where: { organizationId_code: { organizationId: orgId, code } },
    });
    if (existing) {
      throw new AppError(`Warehouse with code ${code} already exists`, 409);
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        organizationId: orgId,
        facilityId: facility.id,
        code,
        name: input.name.trim(),
        isActive: true,
      },
      include: {
        facility: {
          select: { id: true, code: true, name: true, state: true, isActive: true },
        },
      },
    });

    await auditService.log({
      organizationId: orgId,
      userId: user.id,
      userEmail: user.email,
      action: "CREATE",
      entity: "Warehouse",
      entityId: warehouse.id,
      details: {
        code: warehouse.code,
        name: warehouse.name,
        facilityId: warehouse.facilityId,
      },
    });

    return warehouse;
  }

  async updateWarehouse(
    id: string,
    organizationId: string,
    input: { facilityId?: string; name?: string; isActive?: boolean },
    user: UserContext,
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!warehouse) {
      throw new AppError(`Warehouse ${id} not found`, 404);
    }

    if (input.facilityId && input.facilityId !== warehouse.facilityId) {
      const targetFacility = await prisma.facility.findFirst({
        where: { id: input.facilityId, organizationId: orgId },
      });
      if (!targetFacility || !targetFacility.isActive) {
        throw new AppError("Target facility not found or inactive", 400);
      }
    }

    if (input.isActive === false && warehouse.isActive) {
      const [nonZeroBalance, activeReservation, openOrder, draftRun] =
        await Promise.all([
          prisma.warehouseStockBalance.findFirst({
            where: {
              warehouseId: warehouse.id,
              OR: [{ onHand: { not: 0 } }, { reserved: { gt: 0 } }],
            },
          }),
          prisma.stockReservation.findFirst({
            where: { warehouseId: warehouse.id, status: "ACTIVE" },
          }),
          prisma.salesOrder.findFirst({
            where: {
              warehouseId: warehouse.id,
              status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
              fulfilmentStatus: { not: "FULFILLED" },
            },
          }),
          prisma.productionRun.findFirst({
            where: { warehouseId: warehouse.id, status: "DRAFT" },
          }),
        ]);

      if (nonZeroBalance) {
        throw new AppError(
          "Cannot deactivate warehouse with non-zero stock or reserved inventory; transfer or adjust stock first",
          409,
        );
      }
      if (activeReservation) {
        throw new AppError(
          "Cannot deactivate warehouse with active stock reservations",
          409,
        );
      }
      if (openOrder) {
        throw new AppError(
          "Cannot deactivate warehouse with open unfulfilled sales orders",
          409,
        );
      }
      if (draftRun) {
        throw new AppError(
          "Cannot deactivate warehouse with draft production runs",
          409,
        );
      }
    }

    const updated = await prisma.warehouse.update({
      where: { id: warehouse.id },
      data: {
        facilityId: input.facilityId,
        name: input.name !== undefined ? input.name.trim() : undefined,
        isActive: input.isActive,
      },
      include: {
        facility: {
          select: { id: true, code: true, name: true, state: true, isActive: true },
        },
      },
    });

    await auditService.log({
      organizationId: orgId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "Warehouse",
      entityId: updated.id,
      details: {
        name: updated.name,
        facilityId: updated.facilityId,
        isActive: updated.isActive,
      },
    });

    return updated;
  }
}

export const mastersService = new MastersService();

import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/error.middleware.js";
import type { UserContext } from "@mill-ledger/shared";
import { auditService } from "../reporting/audit.service.js";
import type { Prisma } from "@prisma/client";
import {
  buildPaginationMeta,
  normalizePaginationOptions,
} from "../../utils/pagination.js";

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

  async getProductsMasterPaginated(
    organizationId = "MILL",
    options?: {
      status?: string;
      q?: string;
      limit?: number;
      offset?: number;
      page?: number;
    },
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const where: Prisma.ProductWhereInput = { organizationId: orgId };
    if (options?.status === "ACTIVE") {
      where.isActive = true;
    } else if (options?.status === "ARCHIVED") {
      where.isActive = false;
    }

    if (options?.q?.trim()) {
      const q = options.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { hsnCode: { contains: q, mode: "insensitive" } },
        {
          variants: {
            some: {
              OR: [
                { sku: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const { limit, offset } = normalizePaginationOptions(options, {
      limit: 50,
      maxLimit: 100,
    });

    const [products, total, uoms, finishedGoodsItems, priceLists] =
      await Promise.all([
        prisma.product.findMany({
          where,
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
          take: limit,
          skip: offset,
        }),
        prisma.product.count({ where }),
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

    return {
      products,
      uoms,
      finishedGoodsItems,
      priceLists,
      pagination: buildPaginationMeta(limit, offset, products.length, total),
    };
  }

  async getProductById(organizationId: string, id: string) {
    const orgId = await this.resolveOrgId(organizationId);
    const product = await prisma.product.findFirst({
      where: { id, organizationId: orgId },
      include: {
        variants: {
          include: {
            uom: true,
            inventoryItem: {
              select: { id: true, sku: true, name: true, currentStock: true },
            },
            priceLines: {
              include: { priceList: true },
            },
            recipes: {
              select: {
                id: true,
                name: true,
                version: true,
                isActive: true,
                expectedOutputQty: true,
              },
              orderBy: { version: "desc" },
            },
          },
          orderBy: { sku: "asc" },
        },
      },
    });
    if (!product) {
      throw new AppError(`Product ${id} not found`, 404);
    }
    return product;
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
      actorName: user.name,
      action: "CREATE",
      eventType: "PRODUCT_CREATED",
      entity: "Product",
      entityId: product.id,
      summary: `Product ${product.name} (${product.code}) created`,
      details: {
        code: product.code,
        name: product.name,
        hsnCode: product.hsnCode,
        taxRate: Number(product.taxRate),
      },
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

    const productChanges: Array<{
      field: string;
      label: string;
      kind: "changed";
      previousValue: unknown;
      newValue: unknown;
    }> = [];
    if (input.name !== undefined && existing.name !== updated.name) {
      productChanges.push({
        field: "name",
        label: "Product Name",
        kind: "changed",
        previousValue: existing.name,
        newValue: updated.name,
      });
    }
    if (input.hsnCode !== undefined && existing.hsnCode !== updated.hsnCode) {
      productChanges.push({
        field: "hsnCode",
        label: "HSN Code",
        kind: "changed",
        previousValue: existing.hsnCode,
        newValue: updated.hsnCode,
      });
    }
    if (
      input.taxRate !== undefined &&
      Number(existing.taxRate) !== Number(updated.taxRate)
    ) {
      productChanges.push({
        field: "taxRate",
        label: "GST Rate",
        kind: "changed",
        previousValue: `${Number(existing.taxRate)}%`,
        newValue: `${Number(updated.taxRate)}%`,
      });
    }
    if (
      input.isActive !== undefined &&
      existing.isActive !== updated.isActive
    ) {
      productChanges.push({
        field: "isActive",
        label: "Product Status",
        kind: "changed",
        previousValue: existing.isActive ? "Active" : "Archived",
        newValue: updated.isActive ? "Active" : "Archived",
      });
    }

    const productAction =
      input.isActive !== undefined && existing.isActive !== updated.isActive
        ? updated.isActive
          ? "RESTORE"
          : "ARCHIVE"
        : "UPDATE";

    await auditService.log({
      organizationId: existing.organizationId,
      userId: user.id,
      userEmail: user.email,
      actorName: user.name,
      action: productAction,
      eventType:
        productAction === "ARCHIVE"
          ? "PRODUCT_ARCHIVED"
          : productAction === "RESTORE"
            ? "PRODUCT_RESTORED"
            : "PRODUCT_UPDATED",
      entity: "Product",
      entityId: updated.id,
      summary:
        productAction === "ARCHIVE"
          ? `Product ${updated.name} archived`
          : productAction === "RESTORE"
            ? `Product ${updated.name} restored`
            : `Product ${updated.name} updated`,
      changes: productChanges,
      details: {
        name: updated.name,
        hsnCode: updated.hsnCode,
        taxRate: Number(updated.taxRate),
        isActive: updated.isActive,
      },
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
      actorName: user.name,
      action: "CREATE",
      eventType: "PRODUCT_VARIANT_CREATED",
      entity: "ProductVariant",
      entityId: variant.id,
      summary: `Variant ${variant.name} (${variant.sku}) added to ${product.name}`,
      relatedEntities: [
        {
          entityType: "Product",
          entityId: product.id,
          label: product.name,
          role: "product",
        },
      ],
      details: {
        productId: product.id,
        sku: variant.sku,
        name: variant.name,
        packSize: input.packSize,
      },
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

    const variantChanges: Array<{
      field: string;
      label: string;
      kind: "changed";
      previousValue: unknown;
      newValue: unknown;
    }> = [];
    if (input.name !== undefined && existing.name !== updated.name) {
      variantChanges.push({
        field: "name",
        label: "Variant Name",
        kind: "changed",
        previousValue: existing.name,
        newValue: updated.name,
      });
    }
    if (
      input.packSize !== undefined &&
      Number(existing.packSize) !== Number(updated.packSize)
    ) {
      variantChanges.push({
        field: "packSize",
        label: "Pack Size",
        kind: "changed",
        previousValue: Number(existing.packSize),
        newValue: Number(updated.packSize),
      });
    }
    if (
      input.isActive !== undefined &&
      existing.isActive !== updated.isActive
    ) {
      variantChanges.push({
        field: "isActive",
        label: "Variant Status",
        kind: "changed",
        previousValue: existing.isActive ? "Active" : "Archived",
        newValue: updated.isActive ? "Active" : "Archived",
      });
    }

    await auditService.log({
      organizationId: existing.product.organizationId,
      userId: user.id,
      userEmail: user.email,
      actorName: user.name,
      action: "UPDATE",
      eventType: "PRODUCT_VARIANT_UPDATED",
      entity: "ProductVariant",
      entityId: updated.id,
      summary: `Variant ${updated.name} (${updated.sku}) updated`,
      changes: variantChanges,
      relatedEntities: [
        {
          entityType: "Product",
          entityId: existing.productId,
          label: existing.product.name,
          role: "product",
        },
      ],
      details: {
        productId: existing.productId,
        sku: updated.sku,
        isActive: updated.isActive,
      },
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

    const existingLine = await prisma.priceListLine.findUnique({
      where: {
        priceListId_productVariantId: {
          priceListId,
          productVariantId: input.productVariantId,
        },
      },
    });

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
      include: {
        productVariant: {
          include: { product: true },
        },
      },
    });

    await auditService.log({
      organizationId: priceList.organizationId,
      userId: user.id,
      userEmail: user.email,
      actorName: user.name,
      action: "UPSERT_PRICE",
      eventType: "PRICE_UPDATED",
      entity: "PriceListLine",
      entityId: line.id,
      summary: `Price for ${line.productVariant.sku} on ${priceList.name} set to ₹${Number(input.price).toFixed(2)}`,
      changes: [
        {
          field: "price",
          label: `${priceList.name} Rate`,
          kind: existingLine ? "changed" : "added",
          previousValue: existingLine
            ? `₹${Number(existingLine.price).toFixed(2)}`
            : "Not set",
          newValue: `₹${Number(input.price).toFixed(2)}`,
        },
      ],
      relatedEntities: [
        {
          entityType: "Product",
          entityId: line.productVariant.productId,
          label: line.productVariant.product?.name,
          role: "product",
        },
        {
          entityType: "ProductVariant",
          entityId: line.productVariantId,
          label: line.productVariant.sku,
          role: "variant",
        },
      ],
      details: {
        priceListCode: priceList.code,
        priceListName: priceList.name,
        variantSku: line.productVariant.sku,
        productId: line.productVariant.productId,
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
      details: {
        name: updated.name,
        state: updated.state,
        gstin: updated.gstin,
      },
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
      details: {
        code: facility.code,
        name: facility.name,
        state: facility.state,
      },
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
          select: {
            id: true,
            code: true,
            name: true,
            state: true,
            isActive: true,
          },
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
          select: {
            id: true,
            code: true,
            name: true,
            state: true,
            isActive: true,
          },
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
              status: {
                in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"],
              },
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
          select: {
            id: true,
            code: true,
            name: true,
            state: true,
            isActive: true,
          },
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

import { prisma } from "../../db/client.js";
import {
  ItemCategory,
  MovementType,
  Prisma,
  ProductionRunStatus,
  RecipeItemType,
} from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import type { UserContext } from "@mill-ledger/shared";
import { auditService } from "../reporting/audit.service.js";
import {
  buildPaginationMeta,
  normalizePaginationOptions,
} from "../../utils/pagination.js";
import {
  adjustWarehouseOnHand,
  requireActiveOrgWarehouse,
} from "../inventory/warehouse-balance.helper.js";

export interface ConsumedMaterialInput {
  inventoryItemId: string;
  actualQty: number;
  damagedQty?: number;
}

export interface CreateDraftRunInput {
  organizationId: string;
  warehouseId: string;
  recipeId: string;
  runNumber: string;
  batchCount?: number;
  notes?: string;
  idempotencyKey?: string;
}

export interface PostProductionRunInput {
  organizationId: string;
  warehouseId?: string;
  recipeId?: string;
  runNumber?: string;
  batchCount?: number;
  actualGoodQty: number;
  actualRejectedQty?: number;
  directLaborCost?: number;
  utilityCost?: number;
  notes?: string;
  idempotencyKey?: string;
  consumedMaterials: ConsumedMaterialInput[];
}

export interface ReverseProductionRunInput {
  reason: string;
  reversedByUserId?: string;
}

export class ProductionService {
  private async resolveOrgId(
    orgIdOrCode?: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<string> {
    const target = orgIdOrCode || "MILL";
    const org = await client.organization.findFirst({
      where: {
        OR: [{ id: target }, { code: target }],
      },
    });
    return org ? org.id : target;
  }

  private async resolveWarehouseId(
    warehouseIdOrCode: string,
    organizationId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<string> {
    const warehouse = await requireActiveOrgWarehouse(
      client as Prisma.TransactionClient,
      organizationId,
      warehouseIdOrCode,
    );
    return warehouse.id;
  }

  /**
   * List active BOM recipes for an organization
   */
  async getRecipes(organizationId: string) {
    const resolvedOrgId = await this.resolveOrgId(organizationId);
    return await prisma.recipe.findMany({
      where: {
        organizationId: resolvedOrgId,
        isActive: true,
      },
      include: {
        productVariant: true,
        items: {
          include: {
            inventoryItem: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Create a draft production run with pre populated recipe BOM lines
   */
  async createDraftRun(input: CreateDraftRunInput, user?: UserContext) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: input.recipeId },
      include: {
        items: {
          include: {
            inventoryItem: true,
            uom: true,
          },
        },
        productVariant: true,
      },
    });

    if (!recipe) {
      throw new AppError(`Recipe ${input.recipeId} not found`, 404);
    }

    const resolvedOrgId = await this.resolveOrgId(input.organizationId);
    const resolvedWarehouseId = await this.resolveWarehouseId(
      input.warehouseId,
      resolvedOrgId,
    );
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: resolvedWarehouseId },
    });
    if (!warehouse) {
      throw new AppError(`Warehouse ${input.warehouseId} not found`, 404);
    }

    const batchCount =
      input.batchCount && input.batchCount > 0 ? input.batchCount : 1;
    const expectedOutputQty = Number(recipe.expectedOutputQty) * batchCount;

    try {
      const txResult = await prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.productionRun.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            materials: {
              include: { inventoryItem: true },
            },
            recipe: true,
          },
        });
        if (existing) {
          return existing;
        }
      }

      const run = await tx.productionRun.create({
        data: {
          organizationId: resolvedOrgId,
          warehouseId: resolvedWarehouseId,
          recipeId: recipe.id,
          recipeVersion: recipe.version,
          runNumber: input.runNumber,
          batchCount: batchCount,
          status: ProductionRunStatus.DRAFT,
          expectedOutputQty: expectedOutputQty,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
        },
      });

      for (const item of recipe.items) {
        const plannedQty = Number(item.plannedQty) * batchCount;
        await tx.productionRunMaterial.create({
          data: {
            productionRunId: run.id,
            inventoryItemId: item.inventoryItemId,
            itemType: item.itemType,
            plannedQty: plannedQty,
            actualQty: plannedQty,
            damagedQty: 0,
            varianceQty: 0,
            variancePct: 0,
            isVarianceFlagged: false,
            unitCost: Number(item.inventoryItem.weightedAverageCost),
            totalCost:
              plannedQty * Number(item.inventoryItem.weightedAverageCost),
          },
        });
      }

      return await tx.productionRun.findUnique({
        where: { id: run.id },
        include: {
          materials: {
            include: { inventoryItem: true },
          },
          recipe: true,
        },
      });
    });

    if (txResult) {
      await auditService.log({
        organizationId: txResult.organizationId,
        userId: user?.id,
        userEmail: user?.email,
        action: "CREATE",
        entity: "ProductionRun",
        entityId: txResult.id,
        details: {
          runNumber: txResult.runNumber,
          status: txResult.status,
          recipeId: txResult.recipeId,
          warehouseId: txResult.warehouseId,
        },
      });
    }

    return txResult;
    } catch (err: unknown) {
      if (
        input.idempotencyKey &&
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002"
      ) {
        const existing = await prisma.productionRun.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            materials: {
              include: { inventoryItem: true },
            },
            recipe: true,
          },
        });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  /**
   * Post production run atomically:
   * 1. Check idempotency and run existence
   * 2. Snapshot current weighted average unit costs for raw and packaging materials
   * 3. Compute material consumption variances and flags (e.g. oil +5%)
   * 4. Compute yield variances and flags (e.g. murukku -6%)
   * 5. Check carton capacity vs good packets (e.g. 9 cartons hold 180 of 188 packets warning)
   * 6. Sum direct material, labor, and utility costs to derive total run cost and cost per good unit
   * 7. Atomically deduct materials from inventory with negative stock movements
   * 8. Atomically add finished goods to inventory with positive stock movement
   * 9. Transition run status to POSTED
   */
  async postProductionRun(
    runIdOrDraft: string | undefined,
    input: PostProductionRunInput,
    user?: UserContext,
  ) {
    if (input.actualGoodQty <= 0) {
      throw new AppError(
        "Actual good output quantity must be greater than zero",
        400,
      );
    }
    if (!input.consumedMaterials || input.consumedMaterials.length === 0) {
      throw new AppError("Production run must include consumed materials", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      if (input.idempotencyKey) {
        const existingRun = await tx.productionRun.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            materials: {
              include: { inventoryItem: true },
            },
            recipe: {
              include: { productVariant: true },
            },
            warehouse: true,
          },
        });

        if (existingRun && existingRun.status === ProductionRunStatus.POSTED) {
          return {
            run: existingRun,
            warnings: [] as string[],
          };
        }
      }

      let runRecord = runIdOrDraft
        ? await tx.productionRun.findUnique({
            where: { id: runIdOrDraft },
            include: {
              recipe: {
                include: {
                  items: true,
                  productVariant: true,
                },
              },
            },
          })
        : null;

      const recipeId = runRecord ? runRecord.recipeId : input.recipeId;
      if (!recipeId) {
        throw new AppError("Recipe ID is required", 400);
      }

      const recipe = await tx.recipe.findUnique({
        where: { id: recipeId },
        include: {
          items: true,
          productVariant: true,
        },
      });

      if (!recipe) {
        throw new AppError(`Recipe ${recipeId} not found`, 404);
      }

      const finishedGoodsItemId = recipe.productVariant.inventoryItemId;
      if (!finishedGoodsItemId) {
        throw new AppError(
          `Product variant ${recipe.productVariant.sku} does not have a linked inventory item`,
          400,
        );
      }

      const resolvedOrgId = await this.resolveOrgId(input.organizationId, tx);
      const rawWarehouseId = runRecord
        ? runRecord.warehouseId
        : input.warehouseId;
      if (!rawWarehouseId) {
        throw new AppError("Warehouse ID is required", 400);
      }
      const warehouseId = runRecord
        ? rawWarehouseId
        : await this.resolveWarehouseId(rawWarehouseId, resolvedOrgId, tx);

      const batchCount = runRecord
        ? Number(runRecord.batchCount)
        : input.batchCount && input.batchCount > 0
          ? input.batchCount
          : 1;

      const expectedOutputQty = Number(recipe.expectedOutputQty) * batchCount;
      const actualGoodQty = input.actualGoodQty;
      const actualRejectedQty = input.actualRejectedQty ?? 0;

      // Yield calculation:
      // yield_variance_qty = actual_good_output - expected_good_output
      // yield_variance_pct = (actual_good_output - expected_good_output) / expected_good_output * 100
      const yieldVarianceQty = actualGoodQty - expectedOutputQty;
      const yieldVariancePct =
        expectedOutputQty > 0
          ? (yieldVarianceQty / expectedOutputQty) * 100
          : 0;
      const isYieldFlagged = Math.abs(yieldVariancePct) > 0.001;

      // Direct additional costs
      const directLaborCost = input.directLaborCost ?? 0;
      const utilityCost = input.utilityCost ?? 0;

      const warnings: string[] = [];

      // Process consumed materials
      let directMaterialCost = 0;
      const materialProcessingLines: Array<{
        inventoryItemId: string;
        itemType: RecipeItemType;
        plannedQty: number;
        actualQty: number;
        damagedQty: number;
        varianceQty: number;
        variancePct: number;
        isVarianceFlagged: boolean;
        unitCost: number;
        totalCost: number;
        itemName: string;
      }> = [];

      for (const consumed of input.consumedMaterials) {
        if (consumed.actualQty < 0) {
          throw new AppError(
            "Material consumed quantity cannot be negative",
            400,
          );
        }

        const invItems = await tx.$queryRaw<
          Array<{
            id: string;
            name: string;
            sku: string;
            category: string;
            baseUomId: string;
            currentStock: unknown;
            weightedAverageCost: unknown;
          }>
        >`SELECT id, name, sku, category, "baseUomId", "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${consumed.inventoryItemId} FOR UPDATE`;
        const invItem = invItems[0];

        if (!invItem) {
          throw new AppError(
            `Inventory item ${consumed.inventoryItemId} not found`,
            404,
          );
        }

        const currentStock = Number(invItem.currentStock);
        if (currentStock < consumed.actualQty) {
          throw new AppError(
            `Insufficient stock for item ${invItem.name} (${invItem.sku}). Required: ${consumed.actualQty}, On-hand: ${currentStock}`,
            400,
          );
        }

        // Match with recipe BOM item
        const recipeItem = recipe.items.find(
          (ri) => ri.inventoryItemId === consumed.inventoryItemId,
        );
        const plannedQty = recipeItem
          ? Number(recipeItem.plannedQty) * batchCount
          : 0;
        const itemType = recipeItem
          ? recipeItem.itemType
          : RecipeItemType.INGREDIENT;
        const tolerancePct = recipeItem?.tolerancePct
          ? Number(recipeItem.tolerancePct)
          : 0;

        const actualQty = consumed.actualQty;
        const damagedQty = consumed.damagedQty ?? 0;
        const varianceQty = actualQty - plannedQty;
        const variancePct =
          plannedQty > 0 ? (varianceQty / plannedQty) * 100 : 0;

        // Flag if variance reaches or exceeds tolerance threshold, or non-zero when tolerance is 0
        const isVarianceFlagged =
          tolerancePct > 0
            ? Math.abs(variancePct) >= tolerancePct
            : Math.abs(variancePct) > 0.001;

        const unitCost = Number(invItem.weightedAverageCost);
        const lineTotalCost = actualQty * unitCost;
        directMaterialCost += lineTotalCost;

        // Check non-blocking packaging capacity warning for packaging items
        if (
          (itemType === RecipeItemType.PACKAGING ||
            invItem.category === ItemCategory.PACKAGING ||
            invItem.sku === "PKG-CARTON") &&
          actualQty > 0
        ) {
          const itemUomId = invItem.baseUomId ?? recipeItem?.uomId;
          let conversion = itemUomId
            ? await tx.unitConversion.findFirst({
                where: {
                  fromUomId: itemUomId,
                  toUomId: recipe.outputUomId,
                },
                include: {
                  fromUom: true,
                  toUom: true,
                },
              })
            : null;

          if (
            !conversion &&
            (invItem.sku === "PKG-CARTON" ||
              invItem.name.toLowerCase().includes("carton"))
          ) {
            conversion = await tx.unitConversion.findFirst({
              where: {
                fromUom: { code: "CARTON" },
                toUomId: recipe.outputUomId,
              },
              include: {
                fromUom: true,
                toUom: true,
              },
            });
          }

          if (conversion) {
            const factor = Number(conversion.factor);
            const unitsHeld = actualQty * factor;
            if (unitsHeld < actualGoodQty) {
              const fromUnit = conversion.fromUom.name.toLowerCase() + "s";
              const toUnit = conversion.toUom.name.toLowerCase() + "s";
              warnings.push(
                `${actualQty} ${fromUnit} represent ${unitsHeld} of ${actualGoodQty} ${toUnit}.`,
              );
            }
          } else if (invItem.sku === "PKG-CARTON") {
            const packetsHeld = actualQty * 20;
            if (packetsHeld < actualGoodQty) {
              warnings.push(
                `${actualQty} cartons represent ${packetsHeld} of ${actualGoodQty} packets.`,
              );
            }
          }
        }

        materialProcessingLines.push({
          inventoryItemId: invItem.id,
          itemType: itemType,
          plannedQty,
          actualQty,
          damagedQty,
          varianceQty,
          variancePct,
          isVarianceFlagged,
          unitCost,
          totalCost: lineTotalCost,
          itemName: invItem.name,
        });
      }

      // Total run cost and unit cost
      const totalRunCost = directMaterialCost + directLaborCost + utilityCost;
      const costPerGoodUnit =
        actualGoodQty > 0 ? totalRunCost / actualGoodQty : 0;

      // Create or update ProductionRun
      const runNumber =
        runRecord?.runNumber ??
        input.runNumber ??
        `RUN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      const packagingMismatch = warnings.length > 0;
      const packagingWarning = packagingMismatch ? warnings.join("; ") : null;

      let runId = runRecord?.id;
      if (!runId) {
        const createdRun = await tx.productionRun.create({
          data: {
            organizationId: resolvedOrgId,
            warehouseId: warehouseId,
            recipeId: recipe.id,
            recipeVersion: recipe.version,
            runNumber: runNumber,
            batchCount: batchCount,
            status: ProductionRunStatus.POSTED,
            expectedOutputQty: expectedOutputQty,
            actualGoodQty: actualGoodQty,
            actualRejectedQty: actualRejectedQty,
            yieldVarianceQty: yieldVarianceQty,
            yieldVariancePct: yieldVariancePct,
            isYieldFlagged: isYieldFlagged,
            packagingMismatch,
            packagingWarning,
            directMaterialCost: directMaterialCost,
            directLaborCost: directLaborCost,
            utilityCost: utilityCost,
            totalRunCost: totalRunCost,
            costPerGoodUnit: costPerGoodUnit,
            notes: input.notes,
            idempotencyKey: input.idempotencyKey,
            postedAt: new Date(),
          },
        });
        runId = createdRun.id;
      } else {
        await tx.productionRun.update({
          where: { id: runId },
          data: {
            status: ProductionRunStatus.POSTED,
            expectedOutputQty: expectedOutputQty,
            actualGoodQty: actualGoodQty,
            actualRejectedQty: actualRejectedQty,
            yieldVarianceQty: yieldVarianceQty,
            yieldVariancePct: yieldVariancePct,
            isYieldFlagged: isYieldFlagged,
            packagingMismatch,
            packagingWarning,
            directMaterialCost: directMaterialCost,
            directLaborCost: directLaborCost,
            utilityCost: utilityCost,
            totalRunCost: totalRunCost,
            costPerGoodUnit: costPerGoodUnit,
            notes: input.notes ?? runRecord?.notes,
            postedAt: new Date(),
          },
        });

        // Clear existing draft materials
        await tx.productionRunMaterial.deleteMany({
          where: { productionRunId: runId },
        });
      }

      // Insert materials and record stock movement deductions
      for (const line of materialProcessingLines) {
        await tx.productionRunMaterial.create({
          data: {
            productionRunId: runId,
            inventoryItemId: line.inventoryItemId,
            itemType: line.itemType,
            plannedQty: line.plannedQty,
            actualQty: line.actualQty,
            damagedQty: line.damagedQty,
            varianceQty: line.varianceQty,
            variancePct: line.variancePct,
            isVarianceFlagged: line.isVarianceFlagged,
            unitCost: line.unitCost,
            totalCost: line.totalCost,
          },
        });

        // Update inventory item current stock
        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: {
            currentStock: {
              decrement: line.actualQty,
            },
          },
        });

        // Append-only stock movement for consumed material
        await tx.stockMovement.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            warehouseId: warehouseId,
            movementType: MovementType.PRODUCTION_CONSUMED,
            quantity: -line.actualQty,
            unitCost: line.unitCost,
            totalCost: line.totalCost,
            referenceDocumentType: "PRODUCTION_RUN",
            referenceDocumentId: runId,
            notes: `Consumed in run ${runNumber}${line.damagedQty > 0 ? ` (${line.damagedQty} damaged)` : ""}`,
          },
        });

        await adjustWarehouseOnHand(tx, {
          organizationId: resolvedOrgId,
          warehouseId,
          inventoryItemId: line.inventoryItemId,
          delta: -line.actualQty,
        });
      }

      // Finished goods stock update & movement
      const finishedItems = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string;
          currentStock: unknown;
          weightedAverageCost: unknown;
        }>
      >`SELECT id, name, sku, "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${finishedGoodsItemId} FOR UPDATE`;
      const finishedItem = finishedItems[0];
      if (!finishedItem) {
        throw new AppError(
          `Finished goods item ${finishedGoodsItemId} not found`,
          404,
        );
      }

      await tx.inventoryItem.update({
        where: { id: finishedItem.id },
        data: {
          currentStock: {
            increment: actualGoodQty,
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: finishedItem.id,
          warehouseId: warehouseId,
          movementType: MovementType.PRODUCTION_OUTPUT,
          quantity: actualGoodQty,
          unitCost: costPerGoodUnit,
          totalCost: totalRunCost,
          referenceDocumentType: "PRODUCTION_RUN",
          referenceDocumentId: runId,
          notes: `Finished good output from run ${runNumber}`,
        },
      });

      await adjustWarehouseOnHand(tx, {
        organizationId: resolvedOrgId,
        warehouseId,
        inventoryItemId: finishedItem.id,
        delta: actualGoodQty,
      });

      const finalRun = await tx.productionRun.findUnique({
        where: { id: runId },
        include: {
          materials: {
            include: { inventoryItem: true },
          },
          recipe: {
            include: { productVariant: true },
          },
          warehouse: true,
        },
      });

      return {
        run: finalRun!,
        warnings,
      };
    }, { timeout: 30000, maxWait: 10000 });

    if (result?.run) {
      await auditService.log({
        organizationId: result.run.organizationId,
        userId: user?.id,
        userEmail: user?.email,
        actorName: user?.name,
        action: "POST",
        eventType: "PRODUCTION_RUN_POSTED",
        entity: "ProductionRun",
        entityId: result.run.id,
        summary: `Production run ${result.run.runNumber} posted (${Number(result.run.actualGoodQty)} good units produced using recipe v${result.run.recipeVersion})`,
        relatedEntities: [
          {
            entityType: "Recipe",
            entityId: result.run.recipeId,
            label: `Recipe v${result.run.recipeVersion}`,
            role: "recipe",
          },
        ],
        details: {
          runNumber: result.run.runNumber,
          status: result.run.status,
          recipeId: result.run.recipeId,
          recipeVersion: result.run.recipeVersion,
          actualYieldQuantity: Number(result.run.actualGoodQty),
          totalCost: Number(result.run.totalRunCost),
        },
      });
    }

    return result;
  }

  /**
   * Reverses a posted production run with compensating stock movements
   * Restores consumed materials and removes output finished goods
   */
  async reverseProductionRun(
    runId: string,
    input: ReverseProductionRunInput,
    user?: UserContext,
  ) {
    if (!input.reason) {
      throw new AppError("Reversal reason is required", 400);
    }

    const reversed = await prisma.$transaction(async (tx) => {
      const run = await tx.productionRun.findUnique({
        where: { id: runId },
        include: {
          materials: true,
          recipe: {
            include: { productVariant: true },
          },
        },
      });

      if (!run) {
        throw new AppError(`Production run ${runId} not found`, 404);
      }

      if (run.status !== ProductionRunStatus.POSTED) {
        throw new AppError(
          `Cannot reverse production run in status ${run.status}. Only POSTED runs can be reversed.`,
          400,
        );
      }

      const finishedGoodsItemId = run.recipe.productVariant.inventoryItemId;
      if (!finishedGoodsItemId) {
        throw new AppError(
          `Product variant ${run.recipe.productVariant.sku} has no inventory item`,
          400,
        );
      }

      const finishedItems = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string;
          currentStock: unknown;
          weightedAverageCost: unknown;
        }>
      >`SELECT id, name, sku, "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${finishedGoodsItemId} FOR UPDATE`;
      const finishedItem = finishedItems[0];
      if (!finishedItem) {
        throw new AppError(
          `Finished goods item ${finishedGoodsItemId} not found`,
          404,
        );
      }

      const actualGoodQty = Number(run.actualGoodQty);
      if (Number(finishedItem.currentStock) < actualGoodQty) {
        throw new AppError(
          `Cannot reverse run: finished goods on-hand (${Number(finishedItem.currentStock)}) is less than run output (${actualGoodQty})`,
          400,
        );
      }

      // 1. Restore consumed raw materials and packaging
      for (const mat of run.materials) {
        const actualQty = Number(mat.actualQty);
        await tx.inventoryItem.update({
          where: { id: mat.inventoryItemId },
          data: {
            currentStock: {
              increment: actualQty,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            inventoryItemId: mat.inventoryItemId,
            warehouseId: run.warehouseId,
            movementType: MovementType.PRODUCTION_REVERSAL,
            quantity: actualQty,
            unitCost: mat.unitCost,
            totalCost: mat.totalCost,
            referenceDocumentType: "PRODUCTION_RUN_REVERSAL",
            referenceDocumentId: run.id,
            notes: `Restored from reversal of run ${run.runNumber}: ${input.reason}`,
          },
        });

        await adjustWarehouseOnHand(tx, {
          organizationId: run.organizationId,
          warehouseId: run.warehouseId,
          inventoryItemId: mat.inventoryItemId,
          delta: actualQty,
        });
      }

      // 2. Deduct finished goods output
      await tx.inventoryItem.update({
        where: { id: finishedItem.id },
        data: {
          currentStock: {
            decrement: actualGoodQty,
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: finishedItem.id,
          warehouseId: run.warehouseId,
          movementType: MovementType.PRODUCTION_REVERSAL,
          quantity: -actualGoodQty,
          unitCost: run.costPerGoodUnit,
          totalCost: run.totalRunCost,
          referenceDocumentType: "PRODUCTION_RUN_REVERSAL",
          referenceDocumentId: run.id,
          notes: `Reversed finished output from run ${run.runNumber}: ${input.reason}`,
        },
      });

      await adjustWarehouseOnHand(tx, {
        organizationId: run.organizationId,
        warehouseId: run.warehouseId,
        inventoryItemId: finishedItem.id,
        delta: -actualGoodQty,
      });

      // 3. Mark run as REVERSED
      const updatedRun = await tx.productionRun.update({
        where: { id: run.id },
        data: {
          status: ProductionRunStatus.REVERSED,
          reversedAt: new Date(),
          reversalReason: input.reason,
        },
        include: {
          materials: {
            include: { inventoryItem: true },
          },
          recipe: {
            include: { productVariant: true },
          },
          warehouse: true,
        },
      });

      // 4. Create Reversal Audit record
      await tx.productionRunReversal.create({
        data: {
          originalRunId: run.id,
          reversalRunNumber: `REV-${run.runNumber}`,
          reason: input.reason,
          reversedByUserId: input.reversedByUserId,
        },
      });

      return updatedRun;
    });

    if (reversed) {
      await auditService.log({
        organizationId: reversed.organizationId,
        userId: user?.id ?? input.reversedByUserId,
        userEmail: user?.email,
        actorName: user?.name,
        action: "REVERSE",
        eventType: "PRODUCTION_RUN_REVERSED",
        entity: "ProductionRun",
        entityId: reversed.id,
        reason: input.reason,
        summary: `Production run ${reversed.runNumber} reversed`,
        relatedEntities: [
          {
            entityType: "Recipe",
            entityId: reversed.recipeId,
            label: `Recipe v${reversed.recipeVersion}`,
            role: "recipe",
          },
        ],
        details: {
          runNumber: reversed.runNumber,
          status: reversed.status,
          recipeId: reversed.recipeId,
          recipeVersion: reversed.recipeVersion,
        },
      });
    }

    return reversed;
  }

  /**
   * List production runs for an organization
   */
  async getProductionRuns(organizationId: string) {
    const resolvedOrgId = await this.resolveOrgId(organizationId);
    return await prisma.productionRun.findMany({
      where: { organizationId: resolvedOrgId },
      include: {
        recipe: {
          include: { productVariant: true },
        },
        warehouse: true,
        materials: {
          include: { inventoryItem: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Paginated production runs list with server-side search, status filter, and total count.
   */
  async getProductionRunsPaginated(
    organizationId: string,
    options?: {
      status?: string;
      q?: string;
      limit?: number;
      offset?: number;
      page?: number;
    },
  ) {
    const resolvedOrgId = await this.resolveOrgId(organizationId);
    const where: Prisma.ProductionRunWhereInput = {
      organizationId: resolvedOrgId,
    };

    if (options?.status && options.status !== "ALL") {
      where.status = options.status as ProductionRunStatus;
    }

    if (options?.q?.trim()) {
      const q = options.q.trim();
      where.OR = [
        { runNumber: { contains: q, mode: "insensitive" } },
        {
          recipe: {
            productVariant: { name: { contains: q, mode: "insensitive" } },
          },
        },
        {
          recipe: {
            productVariant: { sku: { contains: q, mode: "insensitive" } },
          },
        },
      ];
    }

    const { limit, offset } = normalizePaginationOptions(options, {
      limit: 50,
      maxLimit: 100,
    });

    const [runs, total] = await Promise.all([
      prisma.productionRun.findMany({
        where,
        include: {
          recipe: {
            include: { productVariant: true },
          },
          warehouse: true,
          materials: {
            include: { inventoryItem: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.productionRun.count({ where }),
    ]);

    return {
      runs,
      pagination: buildPaginationMeta(limit, offset, runs.length, total),
    };
  }

  /**
   * Get single production run by ID
   */
  async getProductionRunById(runId: string) {
    const run = await prisma.productionRun.findUnique({
      where: { id: runId },
      include: {
        recipe: {
          include: {
            productVariant: true,
            items: {
              include: {
                inventoryItem: true,
                uom: true,
              },
            },
          },
        },
        warehouse: true,
        materials: {
          include: { inventoryItem: true },
        },
        reversal: true,
      },
    });

    if (!run) {
      throw new AppError(`Production run ${runId} not found`, 404);
    }

    return run;
  }

  /**
   * Update a DRAFT production run (IMP-013). Rejects POSTED or REVERSED runs.
   */
  async updateDraftRun(
    runId: string,
    input: {
      notes?: string;
      batchCount?: number;
      actualGoodQty?: number;
      directLaborCost?: number;
      utilityCost?: number;
    },
    user?: UserContext,
  ) {
    const run = await prisma.productionRun.findUnique({
      where: { id: runId },
    });
    if (!run) {
      throw new AppError(`Production run ${runId} not found`, 404);
    }
    if (run.status !== ProductionRunStatus.DRAFT) {
      throw new AppError(
        `Cannot edit production run ${run.runNumber} in status ${run.status}. Only DRAFT runs can be modified.`,
        400,
      );
    }

    const updated = await prisma.productionRun.update({
      where: { id: runId },
      data: {
        notes: input.notes !== undefined ? input.notes : undefined,
        batchCount: input.batchCount !== undefined ? input.batchCount : undefined,
        actualGoodQty:
          input.actualGoodQty !== undefined ? input.actualGoodQty : undefined,
        directLaborCost:
          input.directLaborCost !== undefined ? input.directLaborCost : undefined,
        utilityCost:
          input.utilityCost !== undefined ? input.utilityCost : undefined,
      },
      include: {
        materials: { include: { inventoryItem: true } },
        recipe: true,
      },
    });

    await auditService.log({
      organizationId: run.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      action: "UPDATE",
      entity: "ProductionRun",
      entityId: run.id,
      details: { runNumber: run.runNumber, status: run.status },
    });

    return updated;
  }

  /**
   * Delete a DRAFT production run (IMP-013). Rejects POSTED or REVERSED runs.
   */
  async deleteDraftRun(runId: string, user?: UserContext) {
    const run = await prisma.productionRun.findUnique({
      where: { id: runId },
    });
    if (!run) {
      throw new AppError(`Production run ${runId} not found`, 404);
    }
    if (run.status !== ProductionRunStatus.DRAFT) {
      throw new AppError(
        `Cannot delete production run ${run.runNumber} in status ${run.status}. Use reversal for POSTED runs.`,
        400,
      );
    }

    await prisma.productionRun.delete({ where: { id: runId } });

    await auditService.log({
      organizationId: run.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      action: "DELETE",
      entity: "ProductionRun",
      entityId: run.id,
      details: { runNumber: run.runNumber },
    });

    return { deleted: true, id: runId };
  }

  /**
   * Get single BOM recipe with items, variant, and recent production runs
   */
  async getRecipeById(organizationId: string, recipeId: string) {
    const orgId = await this.resolveOrgId(organizationId);
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, organizationId: orgId },
      include: {
        productVariant: {
          include: {
            product: { select: { id: true, code: true, name: true } },
            uom: true,
            recipes: {
              select: { id: true, name: true, version: true, isActive: true, createdAt: true },
              orderBy: { version: "desc" },
            },
          },
        },
        outputUom: true,
        items: {
          include: {
            inventoryItem: {
              select: { id: true, sku: true, name: true, currentStock: true, weightedAverageCost: true },
            },
            uom: true,
          },
        },
        productionRuns: {
          select: {
            id: true,
            runNumber: true,
            recipeVersion: true,
            status: true,
            batchCount: true,
            actualGoodQty: true,
            postedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!recipe) {
      throw new AppError(`Recipe ${recipeId} not found`, 404);
    }
    return recipe;
  }

  /**
   * Create a new BOM recipe (IMP-011)
   */
  async createRecipe(
    input: {
      organizationId?: string;
      productVariantId: string;
      name: string;
      standardBatchSize: number;
      expectedOutputQty: number;
      outputUomId: string;
      items: Array<{
        inventoryItemId: string;
        itemType: "INGREDIENT" | "PACKAGING";
        plannedQty: number;
        uomId: string;
        tolerancePct?: number;
      }>;
    },
    user?: UserContext,
  ) {
    const orgId = await this.resolveOrgId(input.organizationId || "MILL");
    const maxVer = await prisma.recipe.aggregate({
      where: { productVariantId: input.productVariantId },
      _max: { version: true },
    });
    const nextVersion = (maxVer._max.version ?? 0) + 1;

    const recipe = await prisma.recipe.create({
      data: {
        organizationId: orgId,
        productVariantId: input.productVariantId,
        version: nextVersion,
        name: input.name.trim(),
        standardBatchSize: input.standardBatchSize,
        expectedOutputQty: input.expectedOutputQty,
        outputUomId: input.outputUomId,
        items: {
          create: input.items.map((it) => ({
            inventoryItemId: it.inventoryItemId,
            itemType: it.itemType,
            plannedQty: it.plannedQty,
            uomId: it.uomId,
            tolerancePct: it.tolerancePct ?? 5.0,
          })),
        },
      },
      include: {
        productVariant: true,
        items: { include: { inventoryItem: true } },
      },
    });

    await auditService.log({
      organizationId: orgId,
      userId: user?.id,
      userEmail: user?.email,
      actorName: user?.name,
      action: "CREATE",
      eventType: "RECIPE_CREATED",
      entity: "Recipe",
      entityId: recipe.id,
      summary: `Recipe ${recipe.name} (v${recipe.version}) created for ${recipe.productVariant.name}`,
      relatedEntities: [
        {
          entityType: "ProductVariant",
          entityId: recipe.productVariantId,
          label: recipe.productVariant.sku,
          role: "variant",
        },
        {
          entityType: "Product",
          entityId: recipe.productVariant.productId,
          role: "product",
        },
      ],
      details: {
        name: recipe.name,
        version: recipe.version,
        productVariantId: recipe.productVariantId,
        expectedOutputQty: Number(recipe.expectedOutputQty),
        itemCount: recipe.items.length,
      },
    });

    return recipe;
  }

  /**
   * Clone an existing BOM recipe into a new version without mutating historical versions (IMP-011)
   */
  async createRecipeVersion(
    recipeId: string,
    input: { name?: string; expectedOutputQty?: number },
    user?: UserContext,
  ) {
    const existing = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { items: true },
    });
    if (!existing) {
      throw new AppError(`Recipe ${recipeId} not found`, 404);
    }

    const maxVer = await prisma.recipe.aggregate({
      where: { productVariantId: existing.productVariantId },
      _max: { version: true },
    });
    const nextVersion = (maxVer._max.version ?? existing.version) + 1;

    const cloned = await prisma.recipe.create({
      data: {
        organizationId: existing.organizationId,
        productVariantId: existing.productVariantId,
        version: nextVersion,
        name: input.name?.trim() || `${existing.name} (v${nextVersion})`,
        standardBatchSize: existing.standardBatchSize,
        expectedOutputQty:
          input.expectedOutputQty ?? existing.expectedOutputQty,
        outputUomId: existing.outputUomId,
        items: {
          create: existing.items.map((it) => ({
            inventoryItemId: it.inventoryItemId,
            itemType: it.itemType,
            plannedQty: it.plannedQty,
            uomId: it.uomId,
            tolerancePct: it.tolerancePct,
          })),
        },
      },
      include: {
        productVariant: true,
        items: { include: { inventoryItem: true } },
      },
    });

    await auditService.log({
      organizationId: existing.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      actorName: user?.name,
      action: "CREATE_VERSION",
      eventType: "RECIPE_VERSION_CREATED",
      entity: "Recipe",
      entityId: cloned.id,
      summary: `Recipe ${cloned.name} (v${cloned.version}) cloned from v${existing.version}`,
      changes: [
        {
          field: "version",
          label: "Recipe Version",
          kind: "changed",
          previousValue: `v${existing.version}`,
          newValue: `v${cloned.version}`,
        },
      ],
      relatedEntities: [
        {
          entityType: "Recipe",
          entityId: existing.id,
          label: `${existing.name} (v${existing.version})`,
          role: "source_recipe",
        },
        {
          entityType: "ProductVariant",
          entityId: cloned.productVariantId,
          label: cloned.productVariant.sku,
          role: "variant",
        },
        {
          entityType: "Product",
          entityId: cloned.productVariant.productId,
          role: "product",
        },
      ],
      details: { fromRecipeId: existing.id, version: cloned.version, productVariantId: cloned.productVariantId },
    });

    return cloned;
  }

  /**
   * Archive or restore a BOM recipe (IMP-011)
   */
  async archiveRecipe(recipeId: string, isActive: boolean, user?: UserContext) {
    const existing = await prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!existing) {
      throw new AppError(`Recipe ${recipeId} not found`, 404);
    }

    const updated = await prisma.recipe.update({
      where: { id: recipeId },
      data: { isActive },
    });

    await auditService.log({
      organizationId: existing.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      actorName: user?.name,
      action: isActive ? "RESTORE" : "ARCHIVE",
      eventType: isActive ? "RECIPE_RESTORED" : "RECIPE_ARCHIVED",
      entity: "Recipe",
      entityId: updated.id,
      summary: `Recipe ${updated.name} (v${updated.version}) ${isActive ? "restored" : "archived"}`,
      changes: [
        {
          field: "isActive",
          label: "Recipe Status",
          kind: "changed",
          previousValue: existing.isActive ? "Active" : "Archived",
          newValue: isActive ? "Active" : "Archived",
        },
      ],
      relatedEntities: [
        {
          entityType: "ProductVariant",
          entityId: existing.productVariantId,
          role: "variant",
        },
      ],
      details: { name: updated.name, version: updated.version, isActive },
    });

    return updated;
  }
}

export const productionService = new ProductionService();

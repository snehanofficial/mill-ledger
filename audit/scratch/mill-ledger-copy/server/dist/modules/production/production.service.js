import { prisma } from "../../db/client.js";
import { MovementType, ProductionRunStatus, RecipeItemType, } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
export class ProductionService {
    /**
     * List active BOM recipes for an organization
     */
    async getRecipes(organizationId) {
        return await prisma.recipe.findMany({
            where: {
                organizationId,
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
    async createDraftRun(input) {
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
        const warehouse = await prisma.warehouse.findUnique({
            where: { id: input.warehouseId },
        });
        if (!warehouse) {
            throw new AppError(`Warehouse ${input.warehouseId} not found`, 404);
        }
        const batchCount = input.batchCount && input.batchCount > 0 ? input.batchCount : 1;
        const expectedOutputQty = Number(recipe.expectedOutputQty) * batchCount;
        return await prisma.$transaction(async (tx) => {
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
                    organizationId: input.organizationId,
                    warehouseId: input.warehouseId,
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
                        totalCost: plannedQty * Number(item.inventoryItem.weightedAverageCost),
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
    async postProductionRun(runIdOrDraft, input) {
        if (input.actualGoodQty <= 0) {
            throw new AppError("Actual good output quantity must be greater than zero", 400);
        }
        if (!input.consumedMaterials || input.consumedMaterials.length === 0) {
            throw new AppError("Production run must include consumed materials", 400);
        }
        return await prisma.$transaction(async (tx) => {
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
                        warnings: [],
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
                throw new AppError(`Product variant ${recipe.productVariant.sku} does not have a linked inventory item`, 400);
            }
            const warehouseId = runRecord ? runRecord.warehouseId : input.warehouseId;
            if (!warehouseId) {
                throw new AppError("Warehouse ID is required", 400);
            }
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
            const yieldVariancePct = expectedOutputQty > 0
                ? (yieldVarianceQty / expectedOutputQty) * 100
                : 0;
            const isYieldFlagged = Math.abs(yieldVariancePct) > 0.001;
            // Direct additional costs
            const directLaborCost = input.directLaborCost ?? 0;
            const utilityCost = input.utilityCost ?? 0;
            const warnings = [];
            // Process consumed materials
            let directMaterialCost = 0;
            const materialProcessingLines = [];
            for (const consumed of input.consumedMaterials) {
                if (consumed.actualQty < 0) {
                    throw new AppError("Material consumed quantity cannot be negative", 400);
                }
                const invItems = await tx.$queryRaw `SELECT id, name, sku, "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${consumed.inventoryItemId} FOR UPDATE`;
                const invItem = invItems[0];
                if (!invItem) {
                    throw new AppError(`Inventory item ${consumed.inventoryItemId} not found`, 404);
                }
                const currentStock = Number(invItem.currentStock);
                if (currentStock < consumed.actualQty) {
                    throw new AppError(`Insufficient stock for item ${invItem.name} (${invItem.sku}). Required: ${consumed.actualQty}, On-hand: ${currentStock}`, 400);
                }
                // Match with recipe BOM item
                const recipeItem = recipe.items.find((ri) => ri.inventoryItemId === consumed.inventoryItemId);
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
                const variancePct = plannedQty > 0 ? (varianceQty / plannedQty) * 100 : 0;
                // Flag if variance reaches or exceeds tolerance threshold, or non-zero when tolerance is 0
                const isVarianceFlagged = tolerancePct > 0
                    ? Math.abs(variancePct) >= tolerancePct
                    : Math.abs(variancePct) > 0.001;
                const unitCost = Number(invItem.weightedAverageCost);
                const lineTotalCost = actualQty * unitCost;
                directMaterialCost += lineTotalCost;
                // Check non-blocking carton packaging capacity warning
                if (invItem.sku === "PKG-CARTON" && actualQty > 0) {
                    const packetsHeld = actualQty * 20;
                    if (packetsHeld < actualGoodQty) {
                        warnings.push(`${actualQty} cartons represent ${packetsHeld} of ${actualGoodQty} packets.`);
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
            const costPerGoodUnit = actualGoodQty > 0 ? totalRunCost / actualGoodQty : 0;
            // Create or update ProductionRun
            const runNumber = runRecord?.runNumber ??
                input.runNumber ??
                `RUN-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
            let runId = runRecord?.id;
            if (!runId) {
                const createdRun = await tx.productionRun.create({
                    data: {
                        organizationId: input.organizationId,
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
            }
            else {
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
            }
            // Finished goods stock update & movement
            const finishedItems = await tx.$queryRaw `SELECT id, name, sku, "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${finishedGoodsItemId} FOR UPDATE`;
            const finishedItem = finishedItems[0];
            if (!finishedItem) {
                throw new AppError(`Finished goods item ${finishedGoodsItemId} not found`, 404);
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
                run: finalRun,
                warnings,
            };
        });
    }
    /**
     * Reverses a posted production run with compensating stock movements
     * Restores consumed materials and removes output finished goods
     */
    async reverseProductionRun(runId, input) {
        if (!input.reason) {
            throw new AppError("Reversal reason is required", 400);
        }
        return await prisma.$transaction(async (tx) => {
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
                throw new AppError(`Cannot reverse production run in status ${run.status}. Only POSTED runs can be reversed.`, 400);
            }
            const finishedGoodsItemId = run.recipe.productVariant.inventoryItemId;
            if (!finishedGoodsItemId) {
                throw new AppError(`Product variant ${run.recipe.productVariant.sku} has no inventory item`, 400);
            }
            const finishedItems = await tx.$queryRaw `SELECT id, name, sku, "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${finishedGoodsItemId} FOR UPDATE`;
            const finishedItem = finishedItems[0];
            if (!finishedItem) {
                throw new AppError(`Finished goods item ${finishedGoodsItemId} not found`, 404);
            }
            const actualGoodQty = Number(run.actualGoodQty);
            if (Number(finishedItem.currentStock) < actualGoodQty) {
                throw new AppError(`Cannot reverse run: finished goods on-hand (${Number(finishedItem.currentStock)}) is less than run output (${actualGoodQty})`, 400);
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
    }
    /**
     * List production runs for an organization
     */
    async getProductionRuns(organizationId) {
        return await prisma.productionRun.findMany({
            where: { organizationId },
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
     * Get single production run by ID
     */
    async getProductionRunById(runId) {
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
}
export const productionService = new ProductionService();

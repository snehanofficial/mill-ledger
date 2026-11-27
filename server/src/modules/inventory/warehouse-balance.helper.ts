import { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";

export interface WarehouseBalanceDelta {
  organizationId: string;
  warehouseId: string;
  inventoryItemId: string;
  delta: Prisma.Decimal | number | string;
}

/**
 * Verify that a warehouse exists, belongs to the specified organization, and is active.
 */
export async function requireActiveOrgWarehouse(
  tx: Prisma.TransactionClient,
  organizationId: string,
  warehouseIdOrCode: string,
) {
  if (!warehouseIdOrCode) {
    throw new AppError("Warehouse ID is required", 400);
  }

  const warehouse = await tx.warehouse.findFirst({
    where: {
      organizationId,
      OR: [{ id: warehouseIdOrCode }, { code: warehouseIdOrCode }],
    },
  });

  if (!warehouse) {
    throw new AppError(
      `Warehouse ${warehouseIdOrCode} not found in organization`,
      404,
    );
  }

  if (!warehouse.isActive) {
    throw new AppError(`Warehouse ${warehouse.code} is inactive`, 400);
  }

  return warehouse;
}

/**
 * Atomically update the warehouse-level on-hand stock projection.
 */
export async function adjustWarehouseOnHand(
  tx: Prisma.TransactionClient,
  params: WarehouseBalanceDelta,
) {
  const deltaDecimal = new Prisma.Decimal(params.delta);

  return tx.warehouseStockBalance.upsert({
    where: {
      warehouseId_inventoryItemId: {
        warehouseId: params.warehouseId,
        inventoryItemId: params.inventoryItemId,
      },
    },
    update: {
      onHand: {
        increment: deltaDecimal,
      },
    },
    create: {
      organizationId: params.organizationId,
      warehouseId: params.warehouseId,
      inventoryItemId: params.inventoryItemId,
      onHand: deltaDecimal,
      reserved: new Prisma.Decimal(0),
    },
  });
}

/**
 * Atomically update the warehouse-level reserved stock projection.
 */
export async function adjustWarehouseReserved(
  tx: Prisma.TransactionClient,
  params: WarehouseBalanceDelta,
) {
  const deltaDecimal = new Prisma.Decimal(params.delta);

  const existing = await tx.warehouseStockBalance.findUnique({
    where: {
      warehouseId_inventoryItemId: {
        warehouseId: params.warehouseId,
        inventoryItemId: params.inventoryItemId,
      },
    },
  });

  if (!existing) {
    const initialReserved = deltaDecimal.lt(0)
      ? new Prisma.Decimal(0)
      : deltaDecimal;
    return tx.warehouseStockBalance.create({
      data: {
        organizationId: params.organizationId,
        warehouseId: params.warehouseId,
        inventoryItemId: params.inventoryItemId,
        onHand: new Prisma.Decimal(0),
        reserved: initialReserved,
      },
    });
  }

  const nextReserved = existing.reserved.plus(deltaDecimal);
  const clamped = nextReserved.lt(0) ? new Prisma.Decimal(0) : nextReserved;

  return tx.warehouseStockBalance.update({
    where: { id: existing.id },
    data: { reserved: clamped },
  });
}

/**
 * Read warehouse-specific onHand, reserved, and available-to-promise (ATP) quantities.
 */
export async function getWarehouseItemBalance(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  inventoryItemId: string,
) {
  const row = await tx.warehouseStockBalance.findUnique({
    where: {
      warehouseId_inventoryItemId: {
        warehouseId,
        inventoryItemId,
      },
    },
  });

  const onHand = row ? row.onHand : new Prisma.Decimal(0);
  const reserved = row ? row.reserved : new Prisma.Decimal(0);
  const available = onHand.minus(reserved);

  return { onHand, reserved, available };
}

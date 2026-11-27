export interface ProductionRunMaterial {
  id: string;
  inventoryItemId: string;
  itemType: "INGREDIENT" | "PACKAGING";
  plannedQty: number;
  actualQty: number;
  damagedQty: number;
  varianceQty: number;
  variancePct: number;
  isVarianceFlagged: boolean;
  unitCost: number;
  totalCost: number;
  inventoryItem: {
    sku: string;
    name: string;
  };
}

export interface ProductionRun {
  id: string;
  runNumber: string;
  recipeId?: string;
  batchCount?: number;
  status: "DRAFT" | "POSTED" | "REVERSED";
  expectedOutputQty: number;
  actualGoodQty: number;
  actualRejectedQty: number;
  yieldVarianceQty: number;
  yieldVariancePct: number;
  isYieldFlagged: boolean;
  packagingMismatch?: boolean;
  packagingWarning?: string | null;
  directMaterialCost: number;
  directLaborCost: number;
  utilityCost: number;
  totalRunCost: number;
  costPerGoodUnit: number;
  notes: string | null;
  createdAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  recipe: {
    name: string;
    version?: number;
    productVariant: {
      name: string;
      sku: string;
    };
  };
  warehouse: {
    name: string;
  };
  materials: ProductionRunMaterial[];
}

export interface InventoryBalanceItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  onHand: number;
  available: number;
  weightedAverageCost: number;
  baseUom: { id?: string; code: string; symbol: string };
}

export interface BomRecipeItem {
  id: string;
  inventoryItemId: string;
  plannedQty: number;
  tolerancePct: number;
  itemType: "INGREDIENT" | "PACKAGING" | string;
  inventoryItem: { id: string; sku: string; name: string };
  uom?: { code: string; symbol: string };
}

export interface BomRecipe {
  id: string;
  name: string;
  version?: number;
  isActive?: boolean;
  standardBatchSize?: number;
  productVariantId?: string;
  expectedOutputQty: number;
  productVariant: { sku: string; name: string };
  outputUom?: { code: string; symbol: string };
  items: BomRecipeItem[];
}

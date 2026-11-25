import { prisma } from "../../server/src/db/client.js";

async function main() {
  console.log("=== CHECKING NEGATIVE STOCK CONSTRAINTS ===");
  
  const item = await prisma.inventoryItem.findFirstOrThrow();
  console.log(`Testing with item: ${item.name} (${item.sku}), currentStock=${item.currentStock}`);

  // 1. Attempt to drive stock below zero via raw SQL
  try {
    await prisma.$executeRaw`UPDATE "inventory_item" SET "currentStock" = -10.000000 WHERE "id" = ${item.id}`;
    console.log("ACTUAL: Database ALLOWED negative stock via raw SQL!");
  } catch (e: any) {
    console.log("ACTUAL: Database REFUSED negative stock via raw SQL! Error:", e.message);
  }

  // 2. Check if check constraint chk_current_stock_non_negative exists in pg_constraint
  const constraints = await prisma.$queryRaw<any[]>`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'inventory_item'::regclass
  `;
  console.log("Constraints on inventory_item:", JSON.stringify(constraints, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

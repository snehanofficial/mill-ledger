/**
 * AUDIT-ONLY SCRIPT
 * Task: Compare schema.prisma with actual PostgreSQL database via information_schema & pg_catalog, report drift
 */
import fs from "node:fs";
import pg from "../../server/node_modules/pg/lib/index.js";

const { Client } = pg;

interface PrismaModel {
  name: string;
  tableName: string;
  fields: {
    name: string;
    columnName: string;
    type: string;
    isOptional: boolean;
    isList: boolean;
    isId: boolean;
    isUnique: boolean;
    default?: string;
    relationTo?: string;
  }[];
  indexes: string[];
  uniques: string[];
}

interface PrismaEnum {
  name: string;
  values: string[];
}

function parsePrismaSchema(content: string): { models: PrismaModel[]; enums: PrismaEnum[] } {
  const models: PrismaModel[] = [];
  const enums: PrismaEnum[] = [];

  const lines = content.split("\n");
  let currentModel: PrismaModel | null = null;
  let currentEnum: PrismaEnum | null = null;

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("//")) continue;

    if (line.startsWith("enum ")) {
      const enumName = line.split(" ")[1].replace("{", "").trim();
      currentEnum = { name: enumName, values: [] };
      continue;
    }

    if (currentEnum) {
      if (line === "}") {
        enums.push(currentEnum);
        currentEnum = null;
      } else {
        const val = line.replace(/,/g, "").trim();
        if (val) currentEnum.values.push(val);
      }
      continue;
    }

    if (line.startsWith("model ")) {
      const modelName = line.split(" ")[1].replace("{", "").trim();
      currentModel = {
        name: modelName,
        tableName: modelName, // default until @@map
        fields: [],
        indexes: [],
        uniques: [],
      };
      continue;
    }

    if (currentModel) {
      if (line === "}") {
        models.push(currentModel);
        currentModel = null;
        continue;
      }

      if (line.startsWith("@@map(")) {
        const match = line.match(/@@map\(["']([^"']+)["']\)/);
        if (match) currentModel.tableName = match[1];
        continue;
      }

      if (line.startsWith("@@unique(")) {
        currentModel.uniques.push(line);
        continue;
      }

      if (line.startsWith("@@index(")) {
        currentModel.indexes.push(line);
        continue;
      }

      // Field definition: name type modifiers...
      const parts = line.split(/\s+/);
      const fieldName = parts[0];
      const rawType = parts[1];

      if (!fieldName || !rawType) continue;

      const isOptional = rawType.endsWith("?");
      const isList = rawType.endsWith("[]");
      const baseType = rawType.replace("?", "").replace("[]", "");

      let columnName = fieldName;
      const mapMatch = line.match(/@map\(["']([^"']+)["']\)/);
      if (mapMatch) columnName = mapMatch[1];

      let defaultValue: string | undefined;
      const defaultMatch = line.match(/@default\(([^)]+)\)/);
      if (defaultMatch) defaultValue = defaultMatch[1];

      currentModel.fields.push({
        name: fieldName,
        columnName,
        type: baseType,
        isOptional,
        isList,
        isId: line.includes("@id"),
        isUnique: line.includes("@unique"),
        default: defaultValue,
      });
    }
  }

  return { models, enums };
}

async function run() {
  const schemaContent = fs.readFileSync("server/prisma/schema.prisma", "utf8");
  const { models, enums } = parsePrismaSchema(schemaContent);

  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/mill_ledger_audit_throwaway?schema=public";
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  console.log("Connected to PostgreSQL for schema audit.");

  // 1. Get all tables in public schema
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const dbTables: string[] = tablesRes.rows.map(r => r.table_name);

  // 2. Get all columns
  const columnsRes = await client.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  // 3. Get all constraints
  const constraintsRes = await client.query(`
    SELECT 
      tc.table_name, 
      tc.constraint_name, 
      tc.constraint_type,
      kcu.column_name,
      cc.check_clause
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name AND tc.constraint_schema = cc.constraint_schema
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `);

  // 4. Get all DB enums
  const enumsRes = await client.query(`
    SELECT t.typname as enum_name, e.enumlabel as enum_value
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY enum_name, e.enumsortorder;
  `);

  await client.end();

  // Save evidence
  fs.writeFileSync("audit/evidence/prisma-models-parsed.json", JSON.stringify({ models, enums }, null, 2));
  fs.writeFileSync("audit/evidence/database-schema.json", JSON.stringify({
    tables: dbTables,
    columns: columnsRes.rows,
    constraints: constraintsRes.rows,
    enums: enumsRes.rows,
  }, null, 2));

  // Compute Drift
  const prismaTableNames = new Set(models.map(m => m.tableName));
  const dbTableNames = new Set(dbTables);

  const tablesOnlyInDb = dbTables.filter(t => !prismaTableNames.has(t));
  const tablesOnlyInPrisma = models.filter(m => !dbTableNames.has(m.tableName)).map(m => m.tableName);

  // Group columns by table
  const dbColumnsByTable: Record<string, any[]> = {};
  for (const c of columnsRes.rows) {
    if (!dbColumnsByTable[c.table_name]) dbColumnsByTable[c.table_name] = [];
    dbColumnsByTable[c.table_name].push(c);
  }

  // Format Markdown Report
  let md = "# Prisma Schema vs Database Drift Report\n\n";
  md += `Database URL: \`${dbUrl.replace(/:[^:@]+@/, ":***@")}\`\n\n`;
  md += "## Summary\n\n";
  md += `- Prisma Models Count: ${models.length}\n`;
  md += `- Prisma Enums Count: ${enums.length}\n`;
  md += `- PostgreSQL Tables Count: ${dbTables.length}\n`;
  md += `- Tables only in PostgreSQL: ${tablesOnlyInDb.length ? tablesOnlyInDb.join(", ") : "None"}\n`;
  md += `- Tables only in Prisma: ${tablesOnlyInPrisma.length ? tablesOnlyInPrisma.join(", ") : "None"}\n\n`;

  if (tablesOnlyInDb.includes("_prisma_migrations")) {
    md += "> Note: `_prisma_migrations` is Prisma internal metadata table, expected to be in DB only.\n\n";
  }

  md += "## Model and Table Drift Analysis\n\n";
  md += "| Model Name | Table Name in DB | Prisma Field Count | DB Column Count | Status | Notes |\n";
  md += "|------------|------------------|--------------------|-----------------|--------|-------|\n";

  for (const m of models) {
    const dbCols = dbColumnsByTable[m.tableName] || [];
    // Scalar fields in Prisma (fields that map to columns, excluding relations)
    const scalarFields = m.fields.filter(f => !f.isList && !models.some(other => other.name === f.type));
    const status = dbCols.length === 0 ? "MISSING_IN_DB" : (scalarFields.length === dbCols.length ? "MATCH" : "DRIFT");
    md += `| \`${m.name}\` | \`${m.tableName}\` | ${scalarFields.length} | ${dbCols.length} | ${status} | ${status === "MATCH" ? "Exact match" : `Difference: ${scalarFields.length} scalar fields vs ${dbCols.length} columns`} |\n`;
  }

  md += "\n## Check Constraints (Custom Migration SQL Constraints)\n\n";
  const checkConstraints = constraintsRes.rows.filter(c => c.constraint_type === "CHECK");
  md += "| Table | Constraint Name | Check Clause |\n";
  md += "|-------|-----------------|--------------|\n";
  for (const c of checkConstraints) {
    md += `| \`${c.table_name}\` | \`${c.constraint_name}\` | \`${c.check_clause || "N/A"}\` |\n`;
  }

  md += "\n## Enum Types Reconciliation\n\n";
  const dbEnumMap: Record<string, string[]> = {};
  for (const r of enumsRes.rows) {
    if (!dbEnumMap[r.enum_name]) dbEnumMap[r.enum_name] = [];
    dbEnumMap[r.enum_name].push(r.enum_value);
  }

  md += "| Enum Name | Prisma Values Count | DB Values Count | Drift? |\n";
  md += "|-----------|---------------------|-----------------|--------|\n";
  for (const e of enums) {
    const dbVals = dbEnumMap[e.name] || [];
    const diff = e.values.length !== dbVals.length;
    md += `| \`${e.name}\` | ${e.values.length} | ${dbVals.length} | ${diff ? "**DRIFT**" : "Match"} |\n`;
  }

  fs.writeFileSync("audit/evidence/schema-drift.md", md);
  console.log("Drift analysis complete. Written to audit/evidence/schema-drift.md");
}

run().catch(console.error);

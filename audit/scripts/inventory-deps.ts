/**
 * AUDIT-ONLY SCRIPT
 * Task: Inventory all dependencies and devDependencies across workspaces
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

interface PkgJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface DepInfo {
  workspace: string;
  type: "dependency" | "devDependency";
  name: string;
  declaredVersion: string;
  existsOnRegistry: boolean;
  firstPublish: string;
  latestPublish: string;
  weeklyDownloads: string | number;
  maintainers: string;
  usedInCode: boolean;
  notes: string[];
}

const workspaces = [
  { name: "root", dir: "." },
  { name: "client", dir: "client" },
  { name: "server", dir: "server" },
  { name: "shared", dir: "shared" },
];

async function getWeeklyDownloads(pkgName: string): Promise<string | number> {
  try {
    const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${pkgName}`);
    if (!res.ok) return "N/A";
    const data = await res.json();
    return data.downloads ?? "N/A";
  } catch {
    return "N/A";
  }
}

function checkUsage(pkgName: string, workspaceDir: string): boolean {
  if (pkgName.startsWith("@mill-ledger/")) return true;
  // Type definitions or configs or build tools
  if (pkgName.startsWith("@types/")) return true;
  if (["typescript", "oxlint", "prettier", "vite", "tsx", "prisma"].includes(pkgName)) return true;
  if (pkgName === "tailwindcss" || pkgName === "@tailwindcss/vite") return true;

  try {
    // Search in workspace src, config files, package.json
    const cleanPkg = pkgName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const grepCmd = `grep -rn -E "['\\"]${cleanPkg}['\\/\\"]" ${workspaceDir}/src ${workspaceDir}/*.config.* ${workspaceDir}/*.ts ${workspaceDir}/index.html 2>/dev/null | head -n 1`;
    const res = execSync(grepCmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return res.trim().length > 0;
  } catch {
    return false;
  }
}

async function run() {
  const allDeps: DepInfo[] = [];

  for (const ws of workspaces) {
    const pkgPath = path.join(ws.dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const pkgJson: PkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

    const checkDepList = async (deps: Record<string, string> | undefined, type: "dependency" | "devDependency") => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        if (name.startsWith("@mill-ledger/")) {
          allDeps.push({
            workspace: ws.name,
            type,
            name,
            declaredVersion: version,
            existsOnRegistry: false,
            firstPublish: "workspace internal",
            latestPublish: "workspace internal",
            weeklyDownloads: "workspace internal",
            maintainers: "internal",
            usedInCode: true,
            notes: ["Workspace internal package"],
          });
          continue;
        }

        let pnpmViewData: any = null;
        let exists = false;
        let firstPublish = "N/A";
        let latestPublish = "N/A";
        let maintainers = "N/A";
        const notes: string[] = [];

        try {
          const raw = execSync(`pnpm view ${name} --json`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
          pnpmViewData = JSON.parse(raw);
          exists = true;
          firstPublish = pnpmViewData.time?.created ? pnpmViewData.time.created.split("T")[0] : "unknown";
          latestPublish = pnpmViewData.time?.modified ? pnpmViewData.time.modified.split("T")[0] : "unknown";
          if (Array.isArray(pnpmViewData.maintainers)) {
            maintainers = pnpmViewData.maintainers.map((m: any) => typeof m === "string" ? m : m.name).join(", ");
          }
        } catch {
          exists = false;
          notes.push("FLAG: Does not exist on npm registry!");
        }

        const weeklyDownloads = exists ? await getWeeklyDownloads(name) : "N/A";
        const used = checkUsage(name, ws.dir);
        if (!used) {
          notes.push("FLAG: UNUSED (no import found in workspace)");
        }

        // Suspicious checks
        if (name === "cn") {
          notes.push("FLAG: Potentially redundant/misleading package; project uses clsx + tailwind-merge in client/src/lib/utils.ts");
        }

        allDeps.push({
          workspace: ws.name,
          type,
          name,
          declaredVersion: version,
          existsOnRegistry: exists,
          firstPublish,
          latestPublish,
          weeklyDownloads,
          maintainers,
          usedInCode: used,
          notes,
        });
      }
    };

    await checkDepList(pkgJson.dependencies, "dependency");
    await checkDepList(pkgJson.devDependencies, "devDependency");
  }

  // Write evidence json
  fs.writeFileSync("audit/evidence/dependencies-inventory.json", JSON.stringify(allDeps, null, 2));

  // Generate markdown table
  let md = "# Dependency Inventory\n\n";
  md += "| Workspace | Type | Package | Declared | Exists? | First Published | Latest | Weekly Downloads | Maintainers | Used? | Notes |\n";
  md += "|-----------|------|---------|----------|---------|-----------------|--------|------------------|-------------|-------|-------|\n";

  for (const d of allDeps) {
    const flagStr = d.notes.join("; ");
    md += `| ${d.workspace} | ${d.type} | \`${d.name}\` | ${d.declaredVersion} | ${d.existsOnRegistry ? "Yes" : "**NO**"} | ${d.firstPublish} | ${d.latestPublish} | ${d.weeklyDownloads} | ${d.maintainers.slice(0, 30)} | ${d.usedInCode ? "Yes" : "**NO**"} | ${flagStr} |\n`;
  }

  fs.writeFileSync("audit/evidence/dependencies-table.md", md);
  console.log(`Inventory complete. Processed ${allDeps.length} dependencies.`);
}

run().catch(console.error);

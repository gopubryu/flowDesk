/**
 * One-shot: rewrite StockMovement / StockBalance rows whose itemCode starts with "NAME:".
 * Resolves master codes from SEED_ITEMS names (and itemName on the row).
 *
 * Usage (from repo root, loads .env.local via dotenv if present):
 *   npx --yes tsx scripts/migrate-name-itemcodes.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

function loadEnvLocal() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

loadEnvLocal();

const DEMO_WORKSPACE_ID = "demo-workspace";

/** Mirror of lib/items.ts SEED_ITEMS for server-side resolve */
const SEED: { code: string; name: string }[] = [
  { code: "I001", name: "스테인리스 볼트 M8" },
  { code: "I002", name: "알루미늄 판재" },
  { code: "I003", name: "산업용 윤활유" },
  { code: "I004", name: "LED 패널 조명" },
  { code: "I005", name: "포장용 골판지 상자" },
  { code: "I006", name: "케이블 타이" },
  { code: "I007", name: "산업용 세척제 20L" },
];

function extractName(itemCode: string, itemName: string | null | undefined): string {
  if (itemCode.startsWith("NAME:")) {
    return itemCode.slice("NAME:".length).trim();
  }
  return (itemName || "").trim();
}

function resolveCode(name: string): string | null {
  if (!name) return null;
  const exact = SEED.find((i) => i.name === name);
  if (exact) return exact.code;
  const loose = SEED.find(
    (i) => name.includes(i.name) || i.name.includes(name)
  );
  return loose?.code ?? null;
}

const prisma = new PrismaClient();

async function remapBalance(
  fromCode: string,
  toCode: string,
  itemName: string | null
) {
  const polluted = await prisma.stockBalance.findMany({
    where: { workspaceId: DEMO_WORKSPACE_ID, itemCode: fromCode },
  });
  for (const row of polluted) {
    const existing = await prisma.stockBalance.findUnique({
      where: {
        workspaceId_warehouseCode_itemCode: {
          workspaceId: DEMO_WORKSPACE_ID,
          warehouseCode: row.warehouseCode,
          itemCode: toCode,
        },
      },
    });
    if (existing) {
      await prisma.stockBalance.update({
        where: { id: existing.id },
        data: {
          qty: existing.qty + row.qty,
          itemName: itemName || existing.itemName || row.itemName,
          warehouseName: row.warehouseName ?? existing.warehouseName,
        },
      });
      await prisma.stockBalance.delete({ where: { id: row.id } });
      console.log(
        `  balance merge ${row.warehouseCode} ${fromCode} → ${toCode} (qty ${row.qty})`
      );
    } else {
      await prisma.stockBalance.update({
        where: { id: row.id },
        data: {
          itemCode: toCode,
          itemName: itemName || row.itemName,
        },
      });
      console.log(
        `  balance rename ${row.warehouseCode} ${fromCode} → ${toCode}`
      );
    }
  }
}

async function main() {
  const movements = await prisma.stockMovement.findMany({
    where: {
      workspaceId: DEMO_WORKSPACE_ID,
      itemCode: { startsWith: "NAME:" },
    },
  });
  const balances = await prisma.stockBalance.findMany({
    where: {
      workspaceId: DEMO_WORKSPACE_ID,
      itemCode: { startsWith: "NAME:" },
    },
  });

  console.log(
    `Found ${movements.length} polluted movements, ${balances.length} polluted balances`
  );

  const codePairs = new Map<string, { to: string; name: string }>();
  const unmatched = new Set<string>();

  for (const m of [...movements, ...balances]) {
    const name = extractName(m.itemCode, m.itemName);
    const to = resolveCode(name);
    if (to) {
      codePairs.set(m.itemCode, { to, name: name || m.itemName || to });
    } else {
      unmatched.add(`${m.itemCode} (name=${name || m.itemName || ""})`);
    }
  }

  for (const [from, { to, name }] of codePairs) {
    console.log(`Remap ${from} → ${to} (${name})`);
    const updated = await prisma.stockMovement.updateMany({
      where: { workspaceId: DEMO_WORKSPACE_ID, itemCode: from },
      data: { itemCode: to, itemName: name },
    });
    console.log(`  movements updated: ${updated.count}`);
    await remapBalance(from, to, name);
  }

  // For unmatched: at least move NAME: suffix into itemName for display/search
  for (const m of movements) {
    if (codePairs.has(m.itemCode)) continue;
    const name = extractName(m.itemCode, m.itemName);
    if (name && (!m.itemName || m.itemName !== name)) {
      await prisma.stockMovement.update({
        where: { id: m.id },
        data: { itemName: name },
      });
      console.log(`  set itemName on movement ${m.id}: ${name} (code still ${m.itemCode})`);
    }
  }
  for (const b of balances) {
    if (codePairs.has(b.itemCode)) continue;
    const name = extractName(b.itemCode, b.itemName);
    if (name && (!b.itemName || b.itemName !== name)) {
      await prisma.stockBalance.update({
        where: { id: b.id },
        data: { itemName: name },
      });
      console.log(`  set itemName on balance ${b.id}: ${name} (code still ${b.itemCode})`);
    }
  }

  if (unmatched.size) {
    console.log("Unmatched NAME: codes (left as-is except itemName fill):");
    for (const u of unmatched) console.log(" -", u);
  } else {
    console.log("All NAME: codes remapped.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import type { OutboundStatus, Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  parseDateOnly,
  toDateString,
} from "@/lib/demo";

export function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function serializeMovement(m: {
  id: string;
  date: Date;
  type: StockMovementType;
  slipNo: string;
  warehouseCode: string;
  warehouseName: string | null;
  itemCode: string;
  itemName: string | null;
  itemSpec: string | null;
  itemUnit: string | null;
  qty: number;
  relatedType: string | null;
  relatedId: string | null;
  memo: string | null;
  manager: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  createdAt: Date;
}) {
  return {
    id: m.id,
    date: toDateString(m.date)!,
    type: m.type,
    slipNo: m.slipNo,
    warehouseCode: m.warehouseCode,
    warehouseName: m.warehouseName ?? undefined,
    itemCode: m.itemCode,
    itemName: m.itemName ?? undefined,
    itemSpec: m.itemSpec ?? undefined,
    itemUnit: m.itemUnit ?? undefined,
    qty: m.qty,
    relatedType: m.relatedType ?? undefined,
    relatedId: m.relatedId ?? undefined,
    memo: m.memo ?? undefined,
    manager: m.manager ?? undefined,
    vendorCode: m.vendorCode ?? undefined,
    vendorName: m.vendorName ?? undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

export function serializeBalance(b: {
  id: string;
  warehouseCode: string;
  warehouseName: string | null;
  itemCode: string;
  itemName: string | null;
  qty: number;
  updatedAt: Date;
}) {
  return {
    id: b.id,
    warehouseCode: b.warehouseCode,
    warehouseName: b.warehouseName ?? undefined,
    itemCode: b.itemCode,
    itemName: b.itemName ?? undefined,
    qty: b.qty,
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** YYMMDD from YYYY-MM-DD */
export function yymmdd(dateStr: string): string {
  const d = dateStr.replace(/-/g, "");
  return d.slice(2);
}

export async function allocateSlipNo(
  type: "receipt" | "shipment" | "adjustment",
  dateStr: string
): Promise<string> {
  const prefix =
    type === "receipt" ? "RCV" : type === "shipment" ? "SHP" : "ADJ";
  const stamp = yymmdd(dateStr);
  const head = `${prefix}-${stamp}-`;
  const rows = await prisma.stockMovement.findMany({
    where: {
      workspaceId: DEMO_WORKSPACE_ID,
      slipNo: { startsWith: head },
    },
    select: { slipNo: true },
    distinct: ["slipNo"],
  });
  let max = 0;
  for (const r of rows) {
    const m = /-(\d+)$/.exec(r.slipNo);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${head}${String(max + 1).padStart(2, "0")}`;
}

export async function applyBalanceDelta(
  tx: Prisma.TransactionClient,
  args: {
    warehouseCode: string;
    warehouseName?: string | null;
    itemCode: string;
    itemName?: string | null;
    delta: number;
  }
) {
  const existing = await tx.stockBalance.findUnique({
    where: {
      workspaceId_warehouseCode_itemCode: {
        workspaceId: DEMO_WORKSPACE_ID,
        warehouseCode: args.warehouseCode,
        itemCode: args.itemCode,
      },
    },
  });
  if (existing) {
    return tx.stockBalance.update({
      where: { id: existing.id },
      data: {
        qty: existing.qty + args.delta,
        warehouseName: args.warehouseName ?? existing.warehouseName,
        itemName: args.itemName ?? existing.itemName,
      },
    });
  }
  return tx.stockBalance.create({
    data: {
      workspaceId: DEMO_WORKSPACE_ID,
      warehouseCode: args.warehouseCode,
      warehouseName: args.warehouseName ?? null,
      itemCode: args.itemCode,
      itemName: args.itemName ?? null,
      qty: args.delta,
    },
  });
}

export async function getBalanceQty(
  warehouseCode: string,
  itemCode: string
): Promise<number> {
  const row = await prisma.stockBalance.findUnique({
    where: {
      workspaceId_warehouseCode_itemCode: {
        workspaceId: DEMO_WORKSPACE_ID,
        warehouseCode,
        itemCode,
      },
    },
  });
  return row?.qty ?? 0;
}

export async function sumRelatedQty(args: {
  relatedType: string;
  relatedId: string;
  type: StockMovementType;
}): Promise<number> {
  const agg = await prisma.stockMovement.aggregate({
    where: {
      workspaceId: DEMO_WORKSPACE_ID,
      relatedType: args.relatedType,
      relatedId: args.relatedId,
      type: args.type,
    },
    _sum: { qty: true },
  });
  const raw = agg._sum.qty ?? 0;
  // receipt qty stored positive; shipment negative — return absolute moved qty
  return Math.abs(raw);
}

export function outboundFromQtys(planQty: number, shippedAbs: number): OutboundStatus {
  if (shippedAbs <= 0) return "none";
  if (shippedAbs + 1e-9 >= planQty) return "complete";
  return "partial";
}

export { parseDateOnly, DEMO_WORKSPACE_ID, toDateString };

export type InventorySlipSummary = {
  slipNo: string;
  date: string;
  warehouseCode: string;
  warehouseName?: string;
  vendorName?: string;
  manager?: string;
  memo?: string;
  relatedId?: string;
  totalQty: number;
  lineCount: number;
};

/** Group stock movements of one type into slip list rows (newest first). */
export async function listSlipsByType(
  type: StockMovementType
): Promise<InventorySlipSummary[]> {
  const rows = await prisma.stockMovement.findMany({
    where: { workspaceId: DEMO_WORKSPACE_ID, type },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 3000,
  });
  const map = new Map<string, InventorySlipSummary>();
  for (const m of rows) {
    const key = m.slipNo;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        slipNo: m.slipNo,
        date: toDateString(m.date)!,
        warehouseCode: m.warehouseCode,
        warehouseName: m.warehouseName ?? undefined,
        vendorName: m.vendorName ?? undefined,
        manager: m.manager ?? undefined,
        memo: m.memo ?? undefined,
        relatedId: m.relatedId ?? undefined,
        totalQty: Math.abs(m.qty),
        lineCount: 1,
      });
    } else {
      cur.totalQty += Math.abs(m.qty);
      cur.lineCount += 1;
    }
  }
  return [...map.values()];
}

/** Reject synthetic NAME:… codes — itemCode must be a master code. */
export function assertMasterItemCode(itemCode: string): string | null {
  const code = itemCode.trim();
  if (!code) return "품목코드는 필수예요.";
  if (code.startsWith("NAME:")) {
    return "품목코드에 이름 대체값(NAME:…)을 쓸 수 없어요. 마스터 품목코드를 입력해 주세요.";
  }
  return null;
}


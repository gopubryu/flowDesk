import { NextResponse } from "next/server";
import type { InboundStatus, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  allocateNextPurchaseSlipNo,
  parseDateOnly,
  serializePurchase,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type LineInput = {
  itemCode?: string | null;
  itemName?: string | null;
  spec?: string | null;
  unit?: string | null;
  qty?: number | string | null;
  unitPrice?: number | string | null;
  supply?: number | string | null;
  vat?: number | string | null;
  total?: number | string | null;
  extra?: string | null;
  sortOrder?: number | null;
};

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapLines(lines: LineInput[] | undefined) {
  if (!Array.isArray(lines)) return null;
  return lines
    .map((l, i) => ({
      itemCode: l.itemCode ? String(l.itemCode) : null,
      itemName: String(l.itemName ?? "").trim() || "(미지정)",
      spec: l.spec ? String(l.spec) : null,
      unit: l.unit ? String(l.unit) : null,
      qty: num(l.qty),
      unitPrice: num(l.unitPrice),
      supply: num(l.supply),
      vat: num(l.vat),
      total: num(l.total),
      extra: l.extra ? String(l.extra) : null,
      sortOrder: typeof l.sortOrder === "number" ? l.sortOrder : i,
    }))
    .filter(
      (l) =>
        l.itemName !== "(미지정)" ||
        (l.itemCode && l.itemCode.trim()) ||
        l.qty > 0
    );
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const row = await prisma.purchase.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializePurchase(row));
  } catch (e) {
    console.error("GET /api/purchases/[id]", e);
    return NextResponse.json(
      { error: "Failed to load purchase" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.purchase.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const lineRows = mapLines(body.lines as LineInput[] | undefined);

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.purchaseDate !== undefined)
      data.purchaseDate =
        parseDateOnly(body.purchaseDate) ?? existing.purchaseDate;
    if (body.slipNo !== undefined)
      data.slipNo = body.slipNo ? String(body.slipNo) : null;

    const nextPurchaseDate =
      (data.purchaseDate as Date | undefined) ?? existing.purchaseDate;
    const nextSlip =
      data.slipNo !== undefined
        ? (data.slipNo as string | null)
        : existing.slipNo;
    if (!nextSlip) {
      data.slipNo = await allocateNextPurchaseSlipNo(
        DEMO_WORKSPACE_ID,
        nextPurchaseDate
      );
    }

    if (body.orderNo !== undefined)
      data.orderNo = body.orderNo ? String(body.orderNo) : null;
    if (body.vendorCode !== undefined)
      data.vendorCode = body.vendorCode ? String(body.vendorCode) : null;
    if (body.vendorName !== undefined || body.vendor !== undefined)
      data.vendorName =
        String(body.vendorName ?? body.vendor ?? "").trim() || "(미지정)";
    if (body.manager !== undefined || body.managerName !== undefined)
      data.manager =
        body.manager || body.managerName
          ? String(body.manager ?? body.managerName)
          : null;
    if (body.taxType !== undefined)
      data.taxType = body.taxType ? String(body.taxType) : null;
    if (body.warehouseCode !== undefined)
      data.warehouseCode = body.warehouseCode
        ? String(body.warehouseCode)
        : null;
    if (body.warehouseName !== undefined || body.warehouse !== undefined)
      data.warehouseName =
        body.warehouseName || body.warehouse
          ? String(body.warehouseName ?? body.warehouse)
          : null;
    if (body.currency !== undefined)
      data.currency = body.currency ? String(body.currency) : null;
    if (body.project !== undefined)
      data.project = body.project ? String(body.project) : null;
    if (body.status !== undefined) data.status = body.status as PurchaseStatus;
    if (body.inboundStatus !== undefined)
      data.inboundStatus = body.inboundStatus as InboundStatus;
    if (body.item !== undefined) data.item = String(body.item);
    if (body.itemCode !== undefined)
      data.itemCode = body.itemCode ? String(body.itemCode) : null;
    if (body.quantity !== undefined) data.quantity = num(body.quantity);
    if (body.amount !== undefined) data.amount = num(body.amount);
    if (body.remarks !== undefined)
      data.remarks = body.remarks ? String(body.remarks) : null;
    if (body.sent !== undefined) data.sent = Boolean(body.sent);
    if (body.accountingReflect !== undefined)
      data.accountingReflect = Boolean(body.accountingReflect);
    if (body.printed !== undefined) data.printed = Boolean(body.printed);
    if (body.importedSlip !== undefined)
      data.importedSlip = body.importedSlip
        ? String(body.importedSlip)
        : null;

    if (lineRows) {
      if (body.item === undefined) {
        data.item =
          lineRows.length === 0
            ? "(미지정)"
            : lineRows.length === 1
              ? lineRows[0].itemName
              : `${lineRows[0].itemName} 외 ${lineRows.length - 1}건`;
      }
      if (body.quantity === undefined)
        data.quantity = lineRows.reduce((s, l) => s + l.qty, 0);
      if (body.amount === undefined)
        data.amount = lineRows.reduce((s, l) => s + (l.total || l.supply), 0);
      if (body.itemCode === undefined && lineRows[0]?.itemCode)
        data.itemCode = lineRows[0].itemCode;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (lineRows) {
        await tx.purchaseLine.deleteMany({ where: { purchaseId: id } });
        if (lineRows.length) {
          await tx.purchaseLine.createMany({
            data: lineRows.map((l) => ({ ...l, purchaseId: id })),
          });
        }
      }
      await tx.purchase.update({ where: { id }, data });
      return tx.purchase.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return NextResponse.json(serializePurchase(updated));
  } catch (e) {
    console.error("PATCH /api/purchases/[id]", e);
    const msg = e instanceof Error ? e.message : "Failed to update purchase";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await prisma.purchase.deleteMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/purchases/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete purchase" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { InboundStatus, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  allocateNextPurchaseSlipNo,
  parseDateOnly,
  serializePurchase,
} from "@/lib/demo";
import { canDeletePurchase, canTransitionPurchase, finiteNonNegative, validatePurchaseInput } from "@/lib/erp-rules";
import { serializableInventoryTransaction } from "@/lib/inventory-server";
import { bodyWorkspaceId, authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

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
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLineId?: string | null;
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
      sourceType: l.sourceType ? String(l.sourceType) : null,
      sourceId: l.sourceId ? String(l.sourceId) : null,
      sourceLineId: l.sourceLineId ? String(l.sourceLineId) : null,
    }))
    .filter(
      (l) =>
        l.itemName !== "(미지정)" ||
        (l.itemCode && l.itemCode.trim()) ||
        l.qty > 0
    );
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const row = await prisma.purchase.findFirst({
      where: { id, workspaceId: workspaceId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializePurchase(row));
  } catch (e) {
    return authError(e) ?? NextResponse.json(
      { error: "Failed to load purchase" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const existing = await prisma.purchase.findFirst({
      where: { id, workspaceId: workspaceId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.quantity !== undefined && !finiteNonNegative(Number(body.quantity))) {
      return NextResponse.json({ error: "Quantity must be a finite non-negative number." }, { status: 400 });
    }
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
        workspaceId,
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
    if (body.status !== undefined) {
      const next = body.status as PurchaseStatus;
      if (!canTransitionPurchase(existing.status, next)) {
        return NextResponse.json({ error: `Illegal purchase status transition: ${existing.status} to ${next}.` }, { status: 409 });
      }
      data.status = next;
    }
    // Receipt writes are the sole authority for inbound status.
    if (body.inboundStatus !== undefined)
      return NextResponse.json({ error: "Inbound status is updated by receipt posting only." }, { status: 409 });
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
      data.importedSlip = body.importedSlip ? String(body.importedSlip) : null;
    if (body.sourceType !== undefined) data.sourceType = body.sourceType ? String(body.sourceType) : null;
    if (body.sourceId !== undefined) data.sourceId = body.sourceId ? String(body.sourceId) : null;

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

    const validation = validatePurchaseInput(String(data.vendorName ?? existing.vendorName), lineRows ?? existing.lines);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });

    const updated = await serializableInventoryTransaction(async (tx) => {
      const receiptCount = await tx.stockMovement.count({ where: { workspaceId: workspaceId, relatedType: "purchase", relatedId: id, type: "receipt" } });
      const receiptSensitive = ["vendorCode", "vendorName", "vendor", "lines", "item", "itemCode", "quantity", "amount"].some((key) => body[key] !== undefined);
      if (receiptCount > 0 && receiptSensitive) throw new Error("Purchases with receipt movements cannot change vendor, lines, quantities, or amounts.");
      const current = await tx.purchase.findFirstOrThrow({ where: { id, workspaceId } });
      if (body.status !== undefined && !canTransitionPurchase(current.status, body.status as PurchaseStatus)) throw new Error("Purchase status changed; refresh and try again.");
      if (lineRows) {
        await tx.purchaseLine.deleteMany({ where: { purchaseId: id } });
        if (lineRows.length) {
          await tx.purchaseLine.createMany({
            data: lineRows.map((l) => ({ ...l, purchaseId: id })),
          });
        }
      }
      const result = await tx.purchase.updateMany({ where: { id, workspaceId }, data });
      if (result.count === 0) throw new Error("Purchase no longer exists.");
      return tx.purchase.findFirstOrThrow({
        where: { id, workspaceId },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return NextResponse.json(serializePurchase(updated));
  } catch (e) {
    const auth = authError(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Failed to update purchase";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN]);
    await serializableInventoryTransaction(async (tx) => {
      const current = await tx.purchase.findFirst({ where: { id, workspaceId: workspaceId } });
      if (!current) throw new Error("Not found");
      const movements = await tx.stockMovement.count({ where: { workspaceId: workspaceId, relatedType: "purchase", relatedId: id, type: "receipt" } });
      if (!canDeletePurchase(current.status, current.inboundStatus) || movements > 0) throw new Error("Received purchases cannot be deleted.");
      const result = await tx.purchase.deleteMany({ where: { id, workspaceId: workspaceId } });
      if (result.count === 0) throw new Error("Not found");
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/purchases/[id]", e);
    const message = e instanceof Error ? e.message : "Failed to delete purchase";
    if (message === "Not found") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "Received purchases cannot be deleted.") return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

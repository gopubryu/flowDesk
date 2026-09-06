import { NextResponse } from "next/server";
import type { PurchaseRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  ensureDemoWorkspace,
  parseDateOnly,
  serializePurchaseRequest,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

type LineInput = {
  itemCode?: string | null;
  itemName?: string | null;
  spec?: string | null;
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
  if (!Array.isArray(lines)) return [];
  return lines
    .map((l, i) => ({
      itemCode: l.itemCode ? String(l.itemCode) : null,
      itemName: String(l.itemName ?? "").trim() || "(미지정)",
      spec: l.spec ? String(l.spec) : null,
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

export async function GET() {
  try {
    await ensureDemoWorkspace();
    const rows = await prisma.purchaseRequest.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ requestDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(rows.map(serializePurchaseRequest));
  } catch (e) {
    console.error("GET /api/purchase-requests", e);
    return NextResponse.json(
      { error: "Failed to load purchase requests" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureDemoWorkspace();
    const body = await req.json();
    const lineRows = mapLines(body.lines as LineInput[] | undefined);

    const vendorName =
      String(body.vendorName ?? body.vendor ?? "").trim() || "(미지정)";
    const item =
      String(body.item ?? "").trim() ||
      (lineRows.length === 0
        ? "(미지정)"
        : lineRows.length === 1
          ? lineRows[0].itemName
          : `${lineRows[0].itemName} 외 ${lineRows.length - 1}건`);

    const quantity =
      body.quantity !== undefined
        ? num(body.quantity)
        : lineRows.reduce((s, l) => s + l.qty, 0);
    const amount =
      body.amount !== undefined
        ? num(body.amount)
        : lineRows.reduce((s, l) => s + (l.total || l.supply), 0);

    const created = await prisma.purchaseRequest.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
        requestDate: parseDateOnly(body.requestDate) ?? new Date(),
        slipNo: body.slipNo ? String(body.slipNo) : null,
        vendorCode: body.vendorCode ? String(body.vendorCode) : null,
        vendorName,
        managerCode: body.managerCode ? String(body.managerCode) : null,
        managerName:
          body.managerName || body.manager
            ? String(body.managerName ?? body.manager)
            : null,
        taxType: body.taxType ? String(body.taxType) : null,
        warehouseCode: body.warehouseCode ? String(body.warehouseCode) : null,
        warehouseName:
          body.warehouseName || body.warehouse
            ? String(body.warehouseName ?? body.warehouse)
            : null,
        currency: body.currency ? String(body.currency) : null,
        dueDate: parseDateOnly(body.dueDate),
        status: (body.status as PurchaseRequestStatus) ?? "unconfirmed",
        item,
        quantity,
        amount,
        project: body.project ? String(body.project) : null,
        lines: lineRows.length
          ? { create: lineRows }
          : undefined,
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(serializePurchaseRequest(created), { status: 201 });
  } catch (e) {
    console.error("POST /api/purchase-requests", e);
    return NextResponse.json(
      { error: "Failed to create purchase request" },
      { status: 500 }
    );
  }
}

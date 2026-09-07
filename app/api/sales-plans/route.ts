import { NextResponse } from "next/server";
import type { SalesPlanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  allocateNextSalesPlanSlipNo,
  backfillMissingSalesPlanSlipNos,
  ensureDemoWorkspace,
  parseDateOnly,
  serializeSalesPlan,
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

function summarizeFromLines(
  lineRows: ReturnType<typeof mapLines>,
  body: Record<string, unknown>
) {
  const first = lineRows[0];
  const item =
    body.item !== undefined && String(body.item).trim()
      ? String(body.item).trim()
      : lineRows.length === 0
        ? "(미지정)"
        : lineRows.length === 1
          ? first.itemName
          : `${first.itemName} 외 ${lineRows.length - 1}건`;
  const quantity =
    body.quantity !== undefined
      ? num(body.quantity)
      : lineRows.reduce((s, l) => s + l.qty, 0);
  const amount =
    body.amount !== undefined
      ? num(body.amount)
      : lineRows.reduce((s, l) => s + (l.supply || 0), 0);
  const vat =
    body.vat !== undefined
      ? num(body.vat)
      : lineRows.reduce((s, l) => s + (l.vat || 0), 0);
  const total =
    body.total !== undefined
      ? num(body.total)
      : lineRows.reduce((s, l) => s + (l.total || l.supply || 0), 0);
  const unitPrice =
    body.unitPrice !== undefined
      ? num(body.unitPrice)
      : first
        ? first.unitPrice
        : 0;
  const itemCode =
    body.itemCode !== undefined
      ? body.itemCode
        ? String(body.itemCode)
        : null
      : first?.itemCode ?? null;
  const spec =
    body.spec !== undefined
      ? body.spec
        ? String(body.spec)
        : null
      : first?.spec ?? null;
  return { item, quantity, amount, vat, total, unitPrice, itemCode, spec };
}

export async function GET() {
  try {
    await ensureDemoWorkspace();
    await backfillMissingSalesPlanSlipNos(DEMO_WORKSPACE_ID);
    const rows = await prisma.salesPlan.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(rows.map(serializeSalesPlan));
  } catch (e) {
    console.error("GET /api/sales-plans", e);
    return NextResponse.json(
      { error: "Failed to load sales plans" },
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
    const planDate = parseDateOnly(body.planDate) ?? new Date();
    const slipNo = body.slipNo
      ? String(body.slipNo)
      : await allocateNextSalesPlanSlipNo(DEMO_WORKSPACE_ID, planDate);
    const summary = summarizeFromLines(lineRows, body);

    const created = await prisma.salesPlan.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
        planDate,
        slipNo,
        vendorCode: body.vendorCode ? String(body.vendorCode) : null,
        vendorName,
        item: summary.item,
        itemCode: summary.itemCode,
        spec: summary.spec,
        quantity: summary.quantity,
        unitPrice: summary.unitPrice,
        amount: summary.amount,
        vat: summary.vat,
        total: summary.total,
        status: (body.status as SalesPlanStatus) ?? "confirmed",
        lastModifier: body.lastModifier ? String(body.lastModifier) : null,
        closed: Boolean(body.closed),
        manager: body.manager ? String(body.manager) : null,
        taxType: body.taxType ? String(body.taxType) : null,
        warehouse: body.warehouse ? String(body.warehouse) : null,
        project: body.project ? String(body.project) : null,
        currency: body.currency ? String(body.currency) : null,
        dueDate: parseDateOnly(body.dueDate),
        lines: lineRows.length ? { create: lineRows } : undefined,
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(serializeSalesPlan(created), { status: 201 });
  } catch (e) {
    console.error("POST /api/sales-plans", e);
    return NextResponse.json(
      { error: "Failed to create sales plan" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { InboundStatus, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bodyWorkspaceId, authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import {
  allocateNextPurchaseSlipNo,
  backfillMissingPurchaseSlipNos,
  parseDateOnly,
  serializePurchase,
} from "@/lib/demo";
import { calculateImportBaseAmount, finiteNonNegative, validateImportAmounts, validatePurchaseInput } from "@/lib/erp-rules";

export const dynamic = "force-dynamic";

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
  if (!Array.isArray(lines)) return [];
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

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    await backfillMissingPurchaseSlipNos(workspaceId);
    const rows = await prisma.purchase.findMany({
      where: { workspaceId: workspaceId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(rows.map(serializePurchase));
  } catch (e) {
    return authError(e) ?? NextResponse.json(
      { error: "Failed to load purchases" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    if (body.quantity !== undefined && !finiteNonNegative(Number(body.quantity))) {
      return NextResponse.json({ error: "Quantity must be a finite non-negative number." }, { status: 400 });
    }
    const lineRows = mapLines(body.lines as LineInput[] | undefined);
    const validation = validatePurchaseInput(String(body.vendorName ?? body.vendor ?? "").trim(), lineRows);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });

    const importFields = [body.currency, body.foreignAmount, body.customsDate, body.customsExchangeRate, body.baseAmount, body.importVatBaseAmount, body.importVat];
    const calculatedBaseAmount = calculateImportBaseAmount(body.currency, body.foreignAmount, body.customsExchangeRate);
    const importCurrency = String(body.currency ?? "").trim().toUpperCase();
    if (importCurrency === "USD" || importCurrency === "JPY" || importFields.slice(1).some((value) => value !== undefined && value !== null && value !== "")) {
      const importValidation = validateImportAmounts({ currency: body.currency, foreignAmount: body.foreignAmount, customsExchangeRate: body.customsExchangeRate, baseAmount: calculatedBaseAmount ?? body.baseAmount, importVatBaseAmount: body.importVatBaseAmount, importVat: body.importVat });
      if (importValidation) return NextResponse.json({ error: importValidation }, { status: 400 });
      if (!body.customsDate) return NextResponse.json({ error: "customsDate is required with import amounts." }, { status: 400 });
    }

    const itemCodes = [...new Set([
      ...lineRows.map((line) => line.itemCode).filter((code): code is string => Boolean(code)),
      ...(body.itemCode ? [String(body.itemCode).trim()] : []),
    ])];
    if (itemCodes.length) {
      const known = await prisma.item.findMany({ where: { workspaceId: workspaceId, code: { in: itemCodes } }, select: { code: true } });
      const knownCodes = new Set(known.map((item) => item.code));
      const unknown = itemCodes.find((code) => !knownCodes.has(code));
      if (unknown) return NextResponse.json({ error: `Unknown item code ${unknown}.` }, { status: 400 });
    }

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

    const purchaseDate = parseDateOnly(body.purchaseDate) ?? new Date();
    const slipNo = body.slipNo
      ? String(body.slipNo)
      : await allocateNextPurchaseSlipNo(workspaceId, purchaseDate);

    const first = lineRows[0];
    const created = await prisma.purchase.create({
      data: {
        workspaceId: workspaceId,
        purchaseDate,
        slipNo,
        orderNo: body.orderNo ? String(body.orderNo) : null,
        vendorCode: body.vendorCode ? String(body.vendorCode) : null,
        vendorName,
        manager:
          body.manager || body.managerName
            ? String(body.manager ?? body.managerName)
            : null,
        taxType: body.taxType ? String(body.taxType) : null,
        warehouseCode: body.warehouseCode ? String(body.warehouseCode) : null,
        warehouseName:
          body.warehouseName || body.warehouse
            ? String(body.warehouseName ?? body.warehouse)
            : null,
        currency: body.currency ? String(body.currency) : null,
        foreignAmount: body.foreignAmount ?? null,
        customsDate: parseDateOnly(body.customsDate) ?? null,
        customsExchangeRate: body.customsExchangeRate ?? null,
        baseAmount: calculatedBaseAmount ?? body.baseAmount ?? null,
        importVatBaseAmount: body.importVatBaseAmount ?? null,
        importVat: body.importVat ?? null,
        project: body.project ? String(body.project) : null,
        status: (body.status as PurchaseStatus) ?? "unconfirmed",
        inboundStatus: (body.inboundStatus as InboundStatus) ?? "none",
        item,
        itemCode:
          body.itemCode !== undefined
            ? body.itemCode
              ? String(body.itemCode)
              : null
            : first?.itemCode ?? null,
        quantity,
        amount,
        remarks: body.remarks ? String(body.remarks) : null,
        sent: Boolean(body.sent),
        accountingReflect: Boolean(body.accountingReflect),
        printed: Boolean(body.printed),
        importedSlip: body.importedSlip ? String(body.importedSlip) : null,
        sourceType: body.sourceType ? String(body.sourceType) : null,
        sourceId: body.sourceId ? String(body.sourceId) : null,
        lines: lineRows.length ? { create: lineRows } : undefined,
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(serializePurchase(created), { status: 201 });
  } catch (e) {
    const auth = authError(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Failed to create purchase";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

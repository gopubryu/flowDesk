import { NextResponse } from "next/server";
import { Prisma, QuotationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, toDateString } from "@/lib/demo";
import { normalizeQuotationInput, QuotationValidationError } from "@/lib/quotation-domain";

export type QuotationLineRow = { id: string; itemCode: string | null; itemName: string; spec: string | null; unit: string | null; qty: number; unitPrice: number; supply: number; vat: number; total: number; extra: string | null; sortOrder: number };
export type QuotationRow = {
  id: string; quoteDate: Date; slipNo: string; vendorCode: string | null; vendorName: string;
  managerCode: string | null; managerName: string | null; warehouseCode: string | null; warehouseName: string | null; validUntil: Date | null; status: QuotationStatus;
  taxType: string | null; currency: string | null; project: string | null; remarks: string | null;
  item: string; itemCode: string | null; quantity: number; amount: number; vat: number; total: number;
  convertedSalesPlanId: string | null; convertedAt: Date | null; createdAt: Date; updatedAt: Date;
  lines?: QuotationLineRow[];
  convertedSalesPlan?: { slipNo: string | null } | null;
};

export function serialize(row: QuotationRow, includeLines = true) {
  return {
    id: row.id, quoteDate: toDateString(row.quoteDate)!, slipNo: row.slipNo,
    vendorCode: row.vendorCode ?? undefined, vendorName: row.vendorName,
    managerCode: row.managerCode ?? undefined, managerName: row.managerName ?? undefined,
    warehouseCode: row.warehouseCode ?? undefined, warehouseName: row.warehouseName ?? undefined,
    validUntil: toDateString(row.validUntil), status: row.status, taxType: row.taxType ?? undefined,
    currency: row.currency ?? undefined, project: row.project ?? undefined, remarks: row.remarks ?? undefined,
    item: row.item, itemCode: row.itemCode ?? undefined, quantity: row.quantity, amount: row.amount,
    vat: row.vat, total: row.total, convertedSalesPlanId: row.convertedSalesPlanId ?? undefined,
    convertedSalesPlanSlipNo: row.convertedSalesPlan?.slipNo ?? undefined,
    convertedAt: row.convertedAt?.toISOString(), createdAt: row.createdAt?.toISOString(), updatedAt: row.updatedAt?.toISOString(),
    ...(includeLines ? { lines: (row.lines ?? []).map((line: QuotationLineRow) => ({ id: line.id, itemCode: line.itemCode ?? undefined, itemName: line.itemName, spec: line.spec ?? undefined, unit: line.unit ?? undefined, qty: line.qty, unitPrice: line.unitPrice, supply: line.supply, vat: line.vat, total: line.total, extra: line.extra ?? undefined, sortOrder: line.sortOrder })) } : {}),
  };
}

export async function assertMasterReferences(input: ReturnType<typeof normalizeQuotationInput>) {
  if (input.vendorCode && !await prisma.vendor.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: input.vendorCode } } })) throw new QuotationValidationError("Unknown vendor code");
  if (input.managerCode && !await prisma.employee.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: input.managerCode } } })) throw new QuotationValidationError("Unknown manager code");
  if (input.warehouseCode && !await prisma.warehouse.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: input.warehouseCode } } })) throw new QuotationValidationError("Unknown warehouse code");
  const codes = input.lines.flatMap((line) => line.itemCode ? [line.itemCode] : []);
  if (codes.length) {
    const found = await prisma.item.findMany({ where: { workspaceId: DEMO_WORKSPACE_ID, code: { in: codes } }, select: { code: true } });
    if (found.length !== new Set(codes).size) throw new QuotationValidationError("Unknown item code");
  }
}

export async function expireStaleQuotations() {
  await prisma.quotation.updateMany({ where: { workspaceId: DEMO_WORKSPACE_ID, status: { in: ["draft", "sent"] }, validUntil: { lt: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z") } }, data: { status: "expired" } });
}

export function failure(error: unknown, fallback: string) {
  if (error instanceof QuotationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Duplicate quotation number" }, { status: 409 });
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

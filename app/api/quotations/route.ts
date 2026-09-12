import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, ensureDemoWorkspace, parseDateOnly, toDateString } from "@/lib/demo";
import { calculateQuotationTotals, nextQuotationSlipNo, normalizeQuotationInput, QuotationValidationError } from "@/lib/quotation-domain";

export const dynamic = "force-dynamic";

function serialize(row: any, includeLines = true) {
  return {
    id: row.id, quoteDate: toDateString(row.quoteDate)!, slipNo: row.slipNo,
    vendorCode: row.vendorCode ?? undefined, vendorName: row.vendorName,
    managerCode: row.managerCode ?? undefined, managerName: row.managerName ?? undefined,
    validUntil: toDateString(row.validUntil), status: row.status, taxType: row.taxType ?? undefined,
    currency: row.currency ?? undefined, project: row.project ?? undefined, remarks: row.remarks ?? undefined,
    item: row.item, itemCode: row.itemCode ?? undefined, quantity: row.quantity, amount: row.amount,
    vat: row.vat, total: row.total, convertedSalesPlanId: row.convertedSalesPlanId ?? undefined,
    convertedAt: row.convertedAt?.toISOString(), createdAt: row.createdAt?.toISOString(), updatedAt: row.updatedAt?.toISOString(),
    ...(includeLines ? { lines: (row.lines ?? []).map((line: any) => ({ id: line.id, itemCode: line.itemCode ?? undefined, itemName: line.itemName, spec: line.spec ?? undefined, unit: line.unit ?? undefined, qty: line.qty, unitPrice: line.unitPrice, supply: line.supply, vat: line.vat, total: line.total, extra: line.extra ?? undefined, sortOrder: line.sortOrder })) } : {}),
  };
}

async function assertMasterReferences(input: ReturnType<typeof normalizeQuotationInput>) {
  if (input.vendorCode && !await prisma.vendor.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: input.vendorCode } } })) throw new QuotationValidationError("Unknown vendor code");
  if (input.managerCode && !await prisma.employee.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: input.managerCode } } })) throw new QuotationValidationError("Unknown manager code");
  const codes = input.lines.flatMap((line) => line.itemCode ? [line.itemCode] : []);
  if (codes.length) {
    const found = await prisma.item.findMany({ where: { workspaceId: DEMO_WORKSPACE_ID, code: { in: codes } }, select: { code: true } });
    if (found.length !== new Set(codes).size) throw new QuotationValidationError("Unknown item code");
  }
}

async function expireStaleQuotations() {
  await prisma.quotation.updateMany({ where: { workspaceId: DEMO_WORKSPACE_ID, status: { in: ["draft", "sent"] }, validUntil: { lt: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z") } }, data: { status: "expired" } });
}

function failure(error: unknown, fallback: string) {
  if (error instanceof QuotationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Duplicate quotation number" }, { status: 409 });
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await ensureDemoWorkspace(); await expireStaleQuotations();
    const { searchParams } = new URL(request.url);
    const from = parseDateOnly(searchParams.get("from")); const to = parseDateOnly(searchParams.get("to"));
    const status = searchParams.get("status"); const query = searchParams.get("query")?.trim();
    const rows = await prisma.quotation.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID, ...(from || to ? { quoteDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}), ...(status ? { status: status as any } : {}), ...(query ? { OR: [{ slipNo: { contains: query, mode: "insensitive" } }, { vendorName: { contains: query, mode: "insensitive" } }, { item: { contains: query, mode: "insensitive" } }] } : {}) },
      orderBy: [{ quoteDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(rows.map((row) => serialize(row, false)));
  } catch (error) { return failure(error, "Failed to load quotations"); }
}

export async function POST(request: Request) {
  try {
    await ensureDemoWorkspace();
    const input = normalizeQuotationInput(await request.json());
    if (input.status !== "draft") throw new QuotationValidationError("New quotations must start as draft");
    await assertMasterReferences(input);
    const totals = calculateQuotationTotals(input.lines, input.taxType);
    const existing = await prisma.quotation.findMany({ where: { workspaceId: DEMO_WORKSPACE_ID, quoteDate: parseDateOnly(input.quoteDate)! }, select: { slipNo: true } });
    const slipNo = input.slipNo ?? nextQuotationSlipNo(input.quoteDate, existing.map((row) => row.slipNo));
    const first = totals.lines[0];
    const created = await prisma.quotation.create({ data: { workspaceId: DEMO_WORKSPACE_ID, quoteDate: parseDateOnly(input.quoteDate)!, slipNo, vendorCode: input.vendorCode, vendorName: input.vendorName, managerCode: input.managerCode, managerName: input.managerName, validUntil: parseDateOnly(input.validUntil), status: input.status, taxType: input.taxType, currency: input.currency, project: input.project, remarks: input.remarks, item: totals.lines.length === 1 ? first.itemName : `${first.itemName} 외 ${totals.lines.length - 1}건`, itemCode: first.itemCode, quantity: totals.quantity, amount: totals.amount, vat: totals.vat, total: totals.total, lines: { create: totals.lines } }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
    return NextResponse.json(serialize(created), { status: 201 });
  } catch (error) { return failure(error, "Failed to create quotation"); }
}

export { assertMasterReferences, expireStaleQuotations, failure, serialize };

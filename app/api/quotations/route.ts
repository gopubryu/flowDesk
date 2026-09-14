import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/demo";
import { bodyWorkspaceId } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { calculateQuotationTotals, nextQuotationSlipNo, normalizeQuotationInput, QuotationValidationError } from "@/lib/quotation-domain";
import { assertMasterReferences, expireStaleQuotations, failure, serialize } from "@/lib/quotation-server";
import type { QuotationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(new URL(request.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    await expireStaleQuotations(workspaceId);
    const { searchParams } = new URL(request.url);
    const from = parseDateOnly(searchParams.get("from")); const to = parseDateOnly(searchParams.get("to"));
    const status = searchParams.get("status"); const query = searchParams.get("query")?.trim();
    const rows = await prisma.quotation.findMany({
      where: { workspaceId, ...(from || to ? { quoteDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}), ...(status ? { status: status as QuotationStatus } : {}), ...(query ? { OR: [{ slipNo: { contains: query, mode: "insensitive" } }, { vendorName: { contains: query, mode: "insensitive" } }, { item: { contains: query, mode: "insensitive" } }] } : {}) },
      include: { convertedSalesPlan: { select: { slipNo: true } } },
      orderBy: [{ quoteDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(rows.map((row) => serialize(row, false)));
  } catch (error) { return failure(error, "Failed to load quotations"); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspaceId } = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const input = normalizeQuotationInput(body);
    if (input.status !== "draft") throw new QuotationValidationError("New quotations must start as draft");
    await assertMasterReferences(input, workspaceId);
    const totals = calculateQuotationTotals(input.lines, input.taxType);
    const existing = await prisma.quotation.findMany({ where: { workspaceId, quoteDate: parseDateOnly(input.quoteDate)! }, select: { slipNo: true } });
    const slipNo = input.slipNo ?? nextQuotationSlipNo(input.quoteDate, existing.map((row) => row.slipNo));
    const first = totals.lines[0];
    const created = await prisma.quotation.create({ data: { workspaceId, quoteDate: parseDateOnly(input.quoteDate)!, slipNo, vendorCode: input.vendorCode, vendorName: input.vendorName, managerCode: input.managerCode, managerName: input.managerName, warehouseCode: input.warehouseCode, warehouseName: input.warehouseName, validUntil: parseDateOnly(input.validUntil), status: input.status, taxType: input.taxType, currency: input.currency, project: input.project, remarks: input.remarks, item: totals.lines.length === 1 ? first.itemName : `${first.itemName} 외 ${totals.lines.length - 1}건`, itemCode: first.itemCode, quantity: totals.quantity, amount: totals.amount, vat: totals.vat, total: totals.total, lines: { create: totals.lines } }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
    return NextResponse.json(serialize(created), { status: 201 });
  } catch (error) { return failure(error, "Failed to create quotation"); }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuotationStatus } from "@prisma/client";
import { DEMO_WORKSPACE_ID, parseDateOnly } from "@/lib/demo";
import { assertQuotationMutable, canTransitionQuotation, calculateQuotationTotals, normalizeQuotationInput, QuotationValidationError } from "@/lib/quotation-domain";
import { assertMasterReferences, expireStaleQuotations, failure, serialize } from "@/lib/quotation-server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function find(id: string) {
  await expireStaleQuotations();
  return prisma.quotation.findFirst({ where: { id, workspaceId: DEMO_WORKSPACE_ID }, include: { lines: { orderBy: { sortOrder: "asc" } }, convertedSalesPlan: { select: { slipNo: true } } } });
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params; const quotation = await find(id);
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serialize(quotation));
  } catch (error) { return failure(error, "Failed to load quotation"); }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params; const existing = await find(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const targetStatus = body.status === undefined ? existing.status : String(body.status);
    if (!["draft", "sent", "accepted", "rejected", "expired"].includes(targetStatus)) throw new QuotationValidationError("Invalid quotation status");
    if (!canTransitionQuotation(existing.status, targetStatus as QuotationStatus, existing.validUntil)) throw new QuotationValidationError("Invalid quotation status transition");
    const linesChanged = body.lines !== undefined;
    const amountChanged = ["amount", "vat", "total", "quantity", "unitPrice"].some((key) => body[key] !== undefined);
    const slipNoChanged = body.slipNo !== undefined && String(body.slipNo).trim() !== existing.slipNo;
    assertQuotationMutable(existing.status, { linesChanged, amountChanged, slipNoChanged });
    const input = normalizeQuotationInput({ quoteDate: body.quoteDate ?? existing.quoteDate.toISOString().slice(0, 10), slipNo: body.slipNo ?? existing.slipNo, vendorCode: body.vendorCode ?? existing.vendorCode, vendorName: body.vendorName ?? existing.vendorName, managerCode: body.managerCode ?? existing.managerCode, managerName: body.managerName ?? existing.managerName, validUntil: body.validUntil ?? existing.validUntil?.toISOString().slice(0, 10), status: targetStatus, taxType: body.taxType ?? existing.taxType, currency: body.currency ?? existing.currency, project: body.project ?? existing.project, remarks: body.remarks ?? existing.remarks, lines: body.lines ?? existing.lines });
    await assertMasterReferences(input); const totals = calculateQuotationTotals(input.lines, input.taxType); const first = totals.lines[0];
    const updated = await prisma.$transaction(async (tx) => {
      if (linesChanged) {
        await tx.quotationLine.deleteMany({ where: { quotationId: id } });
        await tx.quotationLine.createMany({ data: totals.lines.map((line) => ({ ...line, quotationId: id })) });
      }
      await tx.quotation.update({ where: { id }, data: { quoteDate: parseDateOnly(input.quoteDate)!, slipNo: input.slipNo!, vendorCode: input.vendorCode, vendorName: input.vendorName, managerCode: input.managerCode, managerName: input.managerName, validUntil: parseDateOnly(input.validUntil), status: input.status, taxType: input.taxType, currency: input.currency, project: input.project, remarks: input.remarks, ...(linesChanged ? { item: totals.lines.length === 1 ? first.itemName : `${first.itemName} 외 ${totals.lines.length - 1}건`, itemCode: first.itemCode, quantity: totals.quantity, amount: totals.amount, vat: totals.vat, total: totals.total } : {}) } });
      return tx.quotation.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" } }, convertedSalesPlan: { select: { slipNo: true } } } });
    });
    return NextResponse.json(serialize(updated));
  } catch (error) { return failure(error, "Failed to update quotation"); }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params; const existing = await find(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(["draft", "sent"] as string[]).includes(existing.status) || existing.convertedSalesPlanId) throw new QuotationValidationError("Only unconverted draft or sent quotations can be deleted");
    await prisma.quotation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error, "Failed to delete quotation"); }
}

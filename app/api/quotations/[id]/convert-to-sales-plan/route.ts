import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, allocateNextSalesPlanSlipNo } from "@/lib/demo";
import { quotationToSalesPlanData } from "@/lib/quotation-conversion";
import { assertQuotationConvertible, QuotationValidationError } from "@/lib/quotation-domain";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({ where: { id, workspaceId: DEMO_WORKSPACE_ID }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
      if (!quotation) return { missing: true as const };
      if (quotation.convertedSalesPlanId) return { duplicate: quotation.convertedSalesPlanId };
      assertQuotationConvertible(quotation);
      const slipNo = await allocateNextSalesPlanSlipNo(DEMO_WORKSPACE_ID, quotation.quoteDate);
      const salesPlan = await tx.salesPlan.create({ data: { ...quotationToSalesPlanData(quotation), workspaceId: DEMO_WORKSPACE_ID, slipNo } });
      await tx.quotation.update({ where: { id }, data: { convertedSalesPlanId: salesPlan.id, convertedAt: new Date() } });
      return { salesPlan };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("duplicate" in result) return NextResponse.json({ error: "Quotation has already been converted", salesPlanId: result.duplicate }, { status: 409 });
    return NextResponse.json({ id: result.salesPlan.id, slipNo: result.salesPlan.slipNo, sourceQuotationId: id }, { status: 201 });
  } catch (error) {
    if (error instanceof QuotationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const quotation = await prisma.quotation.findFirst({ where: { id, workspaceId: DEMO_WORKSPACE_ID }, select: { convertedSalesPlanId: true } });
      return NextResponse.json({ error: "Quotation has already been converted", salesPlanId: quotation?.convertedSalesPlanId }, { status: 409 });
    }
    console.error("POST /api/quotations/[id]/convert-to-sales-plan", error);
    return NextResponse.json({ error: "Failed to convert quotation" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateNextSalesPlanSlipNo } from "@/lib/demo";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { authError } from "@/lib/master-data-server";
import { quotationToSalesPlanData } from "@/lib/quotation-conversion";
import { assertQuotationConvertible, QuotationValidationError } from "@/lib/quotation-domain";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let workspaceId = "";
  try {
    ({ workspaceId } = await requireResolvedWorkspace(new URL(request.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]));
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({ where: { id, workspaceId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
      if (!quotation) return { missing: true as const };
      if (quotation.convertedSalesPlanId) return { duplicate: quotation.convertedSalesPlanId };
      assertQuotationConvertible(quotation);
      const slipNo = await allocateNextSalesPlanSlipNo(workspaceId, quotation.quoteDate);
      const salesPlan = await tx.salesPlan.create({ data: { ...quotationToSalesPlanData(quotation), workspaceId, slipNo } });
      await tx.quotation.updateMany({ where: { id, workspaceId }, data: { convertedSalesPlanId: salesPlan.id, convertedAt: new Date() } });
      return { salesPlan };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("missing" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ("duplicate" in result) return NextResponse.json({ error: "Quotation has already been converted", salesPlanId: result.duplicate }, { status: 409 });
    return NextResponse.json({ id: result.salesPlan.id, slipNo: result.salesPlan.slipNo, sourceQuotationId: id }, { status: 201 });
  } catch (error) {
    const auth = authError(error); if (auth) return auth;
    if (error instanceof QuotationValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const quotation = await prisma.quotation.findFirst({ where: { id, workspaceId }, select: { convertedSalesPlanId: true } });
      return NextResponse.json({ error: "Quotation has already been converted", salesPlanId: quotation?.convertedSalesPlanId }, { status: 409 });
    }
    console.error("POST /api/quotations/[id]/convert-to-sales-plan", error);
    return NextResponse.json({ error: "Failed to convert quotation" }, { status: 500 });
  }
}

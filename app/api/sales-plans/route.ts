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

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET() {
  try {
    await ensureDemoWorkspace();
    await backfillMissingSalesPlanSlipNos(DEMO_WORKSPACE_ID);
    const rows = await prisma.salesPlan.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID },
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
    const vendorName =
      String(body.vendorName ?? body.vendor ?? "").trim() || "(미지정)";
    const item = String(body.item ?? "").trim() || "(미지정)";
    const planDate = parseDateOnly(body.planDate) ?? new Date();
    const slipNo = body.slipNo
      ? String(body.slipNo)
      : await allocateNextSalesPlanSlipNo(DEMO_WORKSPACE_ID, planDate);

    const created = await prisma.salesPlan.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
        planDate,
        slipNo,
        vendorCode: body.vendorCode ? String(body.vendorCode) : null,
        vendorName,
        item,
        quantity: num(body.quantity),
        unitPrice: num(body.unitPrice),
        amount: num(body.amount),
        vat: num(body.vat),
        total: num(body.total),
        status: (body.status as SalesPlanStatus) ?? "confirmed",
        lastModifier: body.lastModifier ? String(body.lastModifier) : null,
        closed: Boolean(body.closed),
        manager: body.manager ? String(body.manager) : null,
        taxType: body.taxType ? String(body.taxType) : null,
        warehouse: body.warehouse ? String(body.warehouse) : null,
        project: body.project ? String(body.project) : null,
        currency: body.currency ? String(body.currency) : null,
        dueDate: parseDateOnly(body.dueDate),
      },
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

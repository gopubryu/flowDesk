import { NextResponse } from "next/server";
import type { StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  ensureDemoWorkspace,
  parseDateOnly,
} from "@/lib/demo";
import { serializeMovement } from "@/lib/inventory-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureDemoWorkspace();
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const warehouseCode = searchParams.get("warehouseCode")?.trim();
    const itemCode = searchParams.get("itemCode")?.trim();
    const type = searchParams.get("type")?.trim() as StockMovementType | undefined;
    const relatedType = searchParams.get("relatedType")?.trim();
    const relatedId = searchParams.get("relatedId")?.trim();
    const slipNo = searchParams.get("slipNo")?.trim();

    const dateFilter: { gte?: Date; lte?: Date } = {};
    const from = parseDateOnly(dateFrom);
    const to = parseDateOnly(dateTo);
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    const rows = await prisma.stockMovement.findMany({
      where: {
        workspaceId: DEMO_WORKSPACE_ID,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
        ...(warehouseCode ? { warehouseCode } : {}),
        ...(itemCode ? { itemCode } : {}),
        ...(type ? { type } : {}),
        ...(relatedType ? { relatedType } : {}),
        ...(relatedId ? { relatedId } : {}),
        ...(slipNo ? { slipNo } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 2000,
    });
    return NextResponse.json(rows.map(serializeMovement));
  } catch (e) {
    console.error("GET /api/inventory/movements", e);
    return NextResponse.json({ error: "수불 조회에 실패했어요." }, { status: 500 });
  }
}

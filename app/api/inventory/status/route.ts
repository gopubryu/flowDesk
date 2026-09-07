import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  ensureDemoWorkspace,
  parseDateOnly,
  toDateString,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDemoWorkspace();
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = parseDateOnly(todayStr)!;

    const [todayMoves, balances, pendingPlans] = await Promise.all([
      prisma.stockMovement.findMany({
        where: {
          workspaceId: DEMO_WORKSPACE_ID,
          date: today,
        },
        select: { type: true, qty: true },
      }),
      prisma.stockBalance.findMany({
        where: { workspaceId: DEMO_WORKSPACE_ID },
        orderBy: [{ warehouseCode: "asc" }, { itemCode: "asc" }],
      }),
      prisma.salesPlan.findMany({
        where: {
          workspaceId: DEMO_WORKSPACE_ID,
          status: { in: ["confirmed", "in_progress"] },
          outboundStatus: { in: ["none", "partial"] },
        },
        orderBy: { planDate: "desc" },
        take: 50,
      }),
    ]);

    let todayIn = 0;
    let todayOut = 0;
    for (const m of todayMoves) {
      if (m.type === "receipt") todayIn += m.qty;
      else if (m.type === "shipment") todayOut += Math.abs(m.qty);
      else if (m.qty > 0) todayIn += m.qty;
      else todayOut += Math.abs(m.qty);
    }

    // pending inbound: receipt movements related to purchase with incomplete — computed client-side mostly.
    // Server provides sales pending + today in/out + balances for min-stock check (minStock from query body not available).
    // Return open sales plans with shipped qty.
    const pendingOutbound = [];
    for (const p of pendingPlans) {
      const agg = await prisma.stockMovement.aggregate({
        where: {
          workspaceId: DEMO_WORKSPACE_ID,
          relatedType: "salesPlan",
          relatedId: p.id,
          type: "shipment",
        },
        _sum: { qty: true },
      });
      const shipped = Math.abs(agg._sum.qty ?? 0);
      const remain = Math.max(0, p.quantity - shipped);
      if (remain > 0) {
        pendingOutbound.push({
          relatedId: p.id,
          vendorName: p.vendorName,
          itemLabel: p.item,
          remainQty: remain,
          planDate: toDateString(p.planDate),
        });
      }
    }

    // pending inbound from receipt-related purchases is not in Prisma — return empty; UI merges localStorage
    const pendingInbound: {
      relatedId: string;
      vendorName?: string;
      itemLabel: string;
      remainQty: number;
    }[] = [];

    return NextResponse.json({
      pendingInbound,
      pendingOutbound,
      belowMinStock: balances.map((b) => ({
        warehouseCode: b.warehouseCode,
        warehouseName: b.warehouseName ?? undefined,
        itemCode: b.itemCode,
        itemName: b.itemName ?? undefined,
        qty: b.qty,
        minStock: 0,
      })),
      balances: balances.map((b) => ({
        warehouseCode: b.warehouseCode,
        warehouseName: b.warehouseName ?? undefined,
        itemCode: b.itemCode,
        itemName: b.itemName ?? undefined,
        qty: b.qty,
      })),
      todayIn,
      todayOut,
    });
  } catch (e) {
    console.error("GET /api/inventory/status", e);
    return NextResponse.json({ error: "재고 현황 조회에 실패했어요." }, { status: 500 });
  }
}

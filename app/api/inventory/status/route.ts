import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, toDateString } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = parseDateOnly(todayStr)!;

    const [todayMoves, balances, pendingPlans] = await Promise.all([
      prisma.stockMovement.findMany({
        where: {
          workspaceId: workspaceId,
          date: today,
        },
        select: { type: true, qty: true },
      }),
      prisma.stockBalance.findMany({
        where: { workspaceId: workspaceId },
        orderBy: [{ warehouseCode: "asc" }, { itemCode: "asc" }],
      }),
      prisma.salesPlan.findMany({
        where: {
          workspaceId: workspaceId,
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
          workspaceId: workspaceId,
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
    const auth = authError(e); if (auth) return auth;
    console.error("GET /api/inventory/status", e);
    return NextResponse.json({ error: "재고 현황 조회에 실패했어요." }, { status: 500 });
  }
}

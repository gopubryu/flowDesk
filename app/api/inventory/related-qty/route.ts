import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { NextResponse } from "next/server";
import type { StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const { searchParams } = new URL(req.url);
    const relatedType = searchParams.get("relatedType")?.trim();
    const relatedIds = (searchParams.get("relatedIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const typeParam = searchParams.get("type")?.trim() as StockMovementType | undefined;
    const detail = searchParams.get("detail") === "lines";
    if (!relatedType || relatedIds.length === 0) {
      return NextResponse.json({});
    }
    // default: receipt for purchase, shipment for salesPlan
    const type: StockMovementType =
      typeParam ||
      (relatedType === "salesPlan" ? "shipment" : "receipt");

    if (detail) {
      const rows = await prisma.stockMovement.groupBy({
        by: ["relatedId", "itemCode"],
        where: { workspaceId: workspaceId, relatedType, relatedId: { in: relatedIds }, type },
        _sum: { qty: true },
      });
      const out: Record<string, Record<string, number>> = {};
      for (const id of relatedIds) out[id] = {};
      for (const row of rows) {
        if (row.relatedId) out[row.relatedId][row.itemCode] = Math.abs(row._sum.qty ?? 0);
      }
      return NextResponse.json(out);
    }
    const rows = await prisma.stockMovement.groupBy({
      by: ["relatedId"],
      where: {
        workspaceId: workspaceId,
        relatedType,
        relatedId: { in: relatedIds },
        type,
      },
      _sum: { qty: true },
    });
    const out: Record<string, number> = {};
    for (const id of relatedIds) out[id] = 0;
    for (const r of rows) {
      if (r.relatedId) out[r.relatedId] = Math.abs(r._sum.qty ?? 0);
    }
    return NextResponse.json(out);
  } catch (e) {
    const auth = authError(e); if (auth) return auth;
    console.error("GET /api/inventory/related-qty", e);
    return NextResponse.json({ error: "연계 수량 조회에 실패했어요." }, { status: 500 });
  }
}

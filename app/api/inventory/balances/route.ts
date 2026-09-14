import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBalance } from "@/lib/inventory-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const { searchParams } = new URL(req.url);
    const warehouseCode = searchParams.get("warehouseCode")?.trim();
    const itemCode = searchParams.get("itemCode")?.trim();
    const itemCodes = (searchParams.get("itemCodes") ?? "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    const rows = await prisma.stockBalance.findMany({
      where: {
        workspaceId: workspaceId,
        ...(warehouseCode ? { warehouseCode } : {}),
        ...(itemCode ? { itemCode } : itemCodes.length ? { itemCode: { in: itemCodes } } : {}),
      },
      orderBy: [{ warehouseCode: "asc" }, { itemCode: "asc" }],
    });
    return NextResponse.json(rows.map(serializeBalance));
  } catch (e) {
    const auth = authError(e); if (auth) return auth;
    console.error("GET /api/inventory/balances", e);
    return NextResponse.json({ error: "재고 조회에 실패했어요." }, { status: 500 });
  }
}

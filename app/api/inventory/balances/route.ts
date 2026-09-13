import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  ensureDemoWorkspace,
} from "@/lib/demo";
import { serializeBalance } from "@/lib/inventory-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureDemoWorkspace();
    const { searchParams } = new URL(req.url);
    const warehouseCode = searchParams.get("warehouseCode")?.trim();
    const itemCode = searchParams.get("itemCode")?.trim();
    const itemCodes = (searchParams.get("itemCodes") ?? "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    const rows = await prisma.stockBalance.findMany({
      where: {
        workspaceId: DEMO_WORKSPACE_ID,
        ...(warehouseCode ? { warehouseCode } : {}),
        ...(itemCode ? { itemCode } : itemCodes.length ? { itemCode: { in: itemCodes } } : {}),
      },
      orderBy: [{ warehouseCode: "asc" }, { itemCode: "asc" }],
    });
    return NextResponse.json(rows.map(serializeBalance));
  } catch (e) {
    console.error("GET /api/inventory/balances", e);
    return NextResponse.json({ error: "재고 조회에 실패했어요." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDemoWorkspace } from "@/lib/demo";
import {
  DEMO_WORKSPACE_ID,
  allocateSlipNo,
  applyBalanceDelta,
  getBalanceQty,
  num,
  parseDateOnly,
  serializeMovement,
} from "@/lib/inventory-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureDemoWorkspace();
    const body = await req.json();
    const warehouseCode = String(body.warehouseCode ?? "").trim();
    const itemCode = String(body.itemCode ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    if (!warehouseCode) {
      return NextResponse.json({ error: "창고는 필수예요." }, { status: 400 });
    }
    if (!itemCode) {
      return NextResponse.json({ error: "품목은 필수예요." }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "조정 사유는 필수예요." }, { status: 400 });
    }
    const dateStr = String(body.date ?? "").trim();
    const date = parseDateOnly(dateStr) ?? new Date();
    const dateKey =
      dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
        ? dateStr
        : date.toISOString().slice(0, 10);

    const bookQty =
      body.bookQty !== undefined && body.bookQty !== null
        ? num(body.bookQty)
        : await getBalanceQty(warehouseCode, itemCode);
    const actualQty = num(body.actualQty);
    const delta = actualQty - bookQty;
    if (Math.abs(delta) < 1e-9) {
      return NextResponse.json(
        { error: "장부수량과 실사수량이 같아 조정이 필요 없어요." },
        { status: 400 }
      );
    }

    const slipNo = await allocateSlipNo("adjustment", dateKey);
    const warehouseName = body.warehouseName
      ? String(body.warehouseName).trim()
      : null;
    const itemName = body.itemName ? String(body.itemName).trim() : null;
    const manager = body.manager ? String(body.manager).trim() : null;

    const movement = await prisma.$transaction(async (tx) => {
      const m = await tx.stockMovement.create({
        data: {
          workspaceId: DEMO_WORKSPACE_ID,
          date,
          type: "adjustment",
          slipNo,
          warehouseCode,
          warehouseName,
          itemCode,
          itemName,
          qty: delta,
          memo: reason,
          manager,
        },
      });
      await applyBalanceDelta(tx, {
        warehouseCode,
        warehouseName,
        itemCode,
        itemName,
        delta,
      });
      return m;
    });

    return NextResponse.json(
      { slipNo, movement: serializeMovement(movement) },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/inventory/adjustments", e);
    return NextResponse.json({ error: "조정 저장에 실패했어요." }, { status: 500 });
  }
}

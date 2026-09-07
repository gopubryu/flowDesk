import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDemoWorkspace } from "@/lib/demo";
import {
  DEMO_WORKSPACE_ID,
  allocateSlipNo,
  applyBalanceDelta,
  num,
  parseDateOnly,
  serializeMovement,
  sumRelatedQty,
  toDateString,
} from "@/lib/inventory-server";

export const dynamic = "force-dynamic";

type LineInput = {
  itemCode?: string;
  itemName?: string;
  itemSpec?: string;
  itemUnit?: string;
  qty?: number | string;
  memo?: string;
};

/** List receipt slips grouped from movements */
export async function GET() {
  try {
    await ensureDemoWorkspace();
    const rows = await prisma.stockMovement.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID, type: "receipt" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 3000,
    });
    type Slip = {
      slipNo: string;
      date: string;
      warehouseCode: string;
      warehouseName?: string;
      vendorName?: string;
      manager?: string;
      memo?: string;
      relatedId?: string;
      totalQty: number;
      lineCount: number;
    };
    const map = new Map<string, Slip>();
    for (const m of rows) {
      const key = m.slipNo;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          slipNo: m.slipNo,
          date: toDateString(m.date)!,
          warehouseCode: m.warehouseCode,
          warehouseName: m.warehouseName ?? undefined,
          vendorName: m.vendorName ?? undefined,
          manager: m.manager ?? undefined,
          memo: m.memo ?? undefined,
          relatedId: m.relatedId ?? undefined,
          totalQty: m.qty,
          lineCount: 1,
        });
      } else {
        cur.totalQty += m.qty;
        cur.lineCount += 1;
      }
    }
    return NextResponse.json([...map.values()]);
  } catch (e) {
    console.error("GET /api/inventory/receipts", e);
    return NextResponse.json({ error: "입고 조회에 실패했어요." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDemoWorkspace();
    const body = await req.json();
    const warehouseCode = String(body.warehouseCode ?? "").trim();
    if (!warehouseCode) {
      return NextResponse.json({ error: "입고창고는 필수예요." }, { status: 400 });
    }
    const dateStr = String(body.date ?? "").trim();
    const date = parseDateOnly(dateStr);
    if (!date) {
      return NextResponse.json({ error: "입고일자가 올바르지 않아요." }, { status: 400 });
    }
    const rawLines = Array.isArray(body.lines) ? (body.lines as LineInput[]) : [];
    const lines = rawLines
      .map((l) => ({
        itemCode: String(l.itemCode ?? "").trim(),
        itemName: l.itemName ? String(l.itemName).trim() : undefined,
        itemSpec: l.itemSpec ? String(l.itemSpec).trim() : undefined,
        itemUnit: l.itemUnit ? String(l.itemUnit).trim() : undefined,
        qty: num(l.qty),
        memo: l.memo ? String(l.memo).trim() : undefined,
      }))
      .filter((l) => l.itemCode && l.qty > 0);

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "이번입고 수량이 0보다 큰 품목을 입력해 주세요." },
        { status: 400 }
      );
    }

    const slipNo =
      (body.slipNo && String(body.slipNo).trim()) ||
      (await allocateSlipNo("receipt", dateStr));

    const warehouseName = body.warehouseName
      ? String(body.warehouseName).trim()
      : null;
    const relatedType = body.relatedType ? String(body.relatedType) : null;
    const relatedId = body.relatedId ? String(body.relatedId) : null;
    const manager = body.manager ? String(body.manager).trim() : null;
    const memo = body.memo ? String(body.memo).trim() : null;
    const vendorCode = body.vendorCode ? String(body.vendorCode).trim() : null;
    const vendorName = body.vendorName ? String(body.vendorName).trim() : null;

    const created = await prisma.$transaction(async (tx) => {
      const movements = [];
      for (const line of lines) {
        const m = await tx.stockMovement.create({
          data: {
            workspaceId: DEMO_WORKSPACE_ID,
            date,
            type: "receipt",
            slipNo,
            warehouseCode,
            warehouseName,
            itemCode: line.itemCode,
            itemName: line.itemName ?? null,
            itemSpec: line.itemSpec ?? null,
            itemUnit: line.itemUnit ?? null,
            qty: line.qty, // +
            relatedType,
            relatedId,
            memo: line.memo || memo,
            manager,
            vendorCode,
            vendorName,
          },
        });
        await applyBalanceDelta(tx, {
          warehouseCode,
          warehouseName,
          itemCode: line.itemCode,
          itemName: line.itemName,
          delta: line.qty,
        });
        movements.push(m);
      }
      return movements;
    });

    let relatedReceivedQty = 0;
    if (relatedType && relatedId) {
      relatedReceivedQty = await sumRelatedQty({
        relatedType,
        relatedId,
        type: "receipt",
      });
    }

    return NextResponse.json(
      {
        slipNo,
        movements: created.map(serializeMovement),
        relatedReceivedQty,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/inventory/receipts", e);
    return NextResponse.json({ error: "입고 저장에 실패했어요." }, { status: 500 });
  }
}

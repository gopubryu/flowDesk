import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDemoWorkspace } from "@/lib/demo";
import {
  DEMO_WORKSPACE_ID,
  allocateSlipNo,
  applyBalanceDelta,
  assertMasterItemCode,
  listSlipsByType,
  num,
  parseDateOnly,
  serializeMovement,
  sumRelatedQty,
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
    const slips = await listSlipsByType("receipt");
    return NextResponse.json(slips);
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

    for (const line of lines) {
      const bad = assertMasterItemCode(line.itemCode);
      if (bad) {
        return NextResponse.json({ error: bad }, { status: 400 });
      }
    }

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

    // A purchase-linked receipt cannot exceed the ordered quantity per item.
    // Validate before writing movements so an invalid receipt is atomic.
    if (relatedType === "purchase" && relatedId) {
      const purchase = await prisma.purchase.findFirst({
        where: { id: relatedId, workspaceId: DEMO_WORKSPACE_ID },
        include: { lines: true },
      });
      if (!purchase) {
        return NextResponse.json({ error: "구매 전표를 찾을 수 없어요." }, { status: 404 });
      }

      const orderedByItem = new Map<string, number>();
      if (purchase.lines.length > 0) {
        for (const line of purchase.lines) {
          if (line.itemCode) {
            orderedByItem.set(
              line.itemCode,
              (orderedByItem.get(line.itemCode) ?? 0) + line.qty
            );
          }
        }
      } else if (purchase.itemCode) {
        orderedByItem.set(purchase.itemCode, purchase.quantity);
      }

      const requestedByItem = new Map<string, number>();
      for (const line of lines) {
        requestedByItem.set(
          line.itemCode,
          (requestedByItem.get(line.itemCode) ?? 0) + line.qty
        );
      }

      const receivedByItem = await prisma.stockMovement.groupBy({
        by: ["itemCode"],
        where: {
          workspaceId: DEMO_WORKSPACE_ID,
          relatedType: "purchase",
          relatedId,
          type: "receipt",
        },
        _sum: { qty: true },
      });
      const receivedMap = new Map(
        receivedByItem.map((row) => [row.itemCode, row._sum.qty ?? 0])
      );

      for (const [itemCode, requested] of requestedByItem) {
        const ordered = orderedByItem.get(itemCode);
        if (ordered === undefined) {
          return NextResponse.json(
            { error: `구매 전표에 없는 품목이에요. [${itemCode}]` },
            { status: 400 }
          );
        }
        const received = receivedMap.get(itemCode) ?? 0;
        const remaining = Math.max(0, ordered - received);
        if (requested > remaining + 1e-9) {
          return NextResponse.json(
            {
              error: `입고 가능 수량을 초과했어요. [${itemCode}] 잔여 ${remaining}, 요청 ${requested}`,
            },
            { status: 400 }
          );
        }
      }
    }

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

    if (relatedType === "purchase" && relatedId) {
      const purchase = await prisma.purchase.findFirst({
        where: { id: relatedId, workspaceId: DEMO_WORKSPACE_ID },
        include: { lines: true },
      });
      if (purchase) {
        const orderedQty = purchase.lines.length > 0
          ? purchase.lines.reduce((sum, line) => sum + line.qty, 0)
          : purchase.quantity;
        await prisma.purchase.update({
          where: { id: purchase.id },
          data: {
            inboundStatus:
              relatedReceivedQty + 1e-9 >= orderedQty
                ? "complete"
                : "partial",
          },
        });
      }
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

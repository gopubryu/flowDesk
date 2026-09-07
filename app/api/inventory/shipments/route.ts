import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDemoWorkspace } from "@/lib/demo";
import {
  DEMO_WORKSPACE_ID,
  allocateSlipNo,
  applyBalanceDelta,
  assertMasterItemCode,
  getBalanceQty,
  listSlipsByType,
  num,
  outboundFromQtys,
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


/** List shipment slips grouped from movements */
export async function GET() {
  try {
    await ensureDemoWorkspace();
    const slips = await listSlipsByType("shipment");
    return NextResponse.json(slips);
  } catch (e) {
    console.error("GET /api/inventory/shipments", e);
    return NextResponse.json({ error: "출하 조회에 실패했어요." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDemoWorkspace();
    const body = await req.json();
    const warehouseCode = String(body.warehouseCode ?? "").trim();
    if (!warehouseCode) {
      return NextResponse.json({ error: "출하창고는 필수예요." }, { status: 400 });
    }
    const dateStr = String(body.date ?? "").trim();
    const date = parseDateOnly(dateStr);
    if (!date) {
      return NextResponse.json({ error: "출하일자가 올바르지 않아요." }, { status: 400 });
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
        { error: "이번출하 수량이 0보다 큰 품목을 입력해 주세요." },
        { status: 400 }
      );
    }

    // Insufficient stock check (no negative outbound)
    for (const line of lines) {
      const bal = await getBalanceQty(warehouseCode, line.itemCode);
      if (line.qty > bal + 1e-9) {
        return NextResponse.json(
          {
            error: `재고가 부족해요. [${line.itemCode}] 현재고 ${bal}, 요청 ${line.qty}`,
          },
          { status: 400 }
        );
      }
    }

    const relatedType = body.relatedType ? String(body.relatedType) : null;
    const relatedId = body.relatedId ? String(body.relatedId) : null;

    // Optional: validate against sales plan remaining qty
    if (relatedType === "salesPlan" && relatedId) {
      const plan = await prisma.salesPlan.findFirst({
        where: { id: relatedId, workspaceId: DEMO_WORKSPACE_ID },
        include: { lines: true },
      });
      if (!plan) {
        return NextResponse.json({ error: "판매계획을 찾을 수 없어요." }, { status: 404 });
      }
      if (!["confirmed", "in_progress"].includes(plan.status)) {
        return NextResponse.json(
          { error: "확인/진행 상태의 판매계획만 출하할 수 있어요." },
          { status: 400 }
        );
      }
      const already = await sumRelatedQty({
        relatedType: "salesPlan",
        relatedId,
        type: "shipment",
      });
      // Per-item remaining if lines exist
      if (plan.lines.length > 0) {
        const shippedByItem = await prisma.stockMovement.groupBy({
          by: ["itemCode"],
          where: {
            workspaceId: DEMO_WORKSPACE_ID,
            relatedType: "salesPlan",
            relatedId,
            type: "shipment",
          },
          _sum: { qty: true },
        });
        const shippedMap = new Map(
          shippedByItem.map((r) => [r.itemCode, Math.abs(r._sum.qty ?? 0)])
        );
        for (const line of lines) {
          const planLine = plan.lines.find(
            (pl) => (pl.itemCode || "") === line.itemCode
          );
          const planQty = planLine?.qty ?? plan.quantity;
          const shipped = shippedMap.get(line.itemCode) ?? 0;
          const remain = Math.max(0, planQty - shipped);
          if (line.qty > remain + 1e-9) {
            return NextResponse.json(
              {
                error: `미출하 수량을 초과했어요. [${line.itemCode}] 미출하 ${remain}, 요청 ${line.qty}`,
              },
              { status: 400 }
            );
          }
        }
      } else {
        const remain = Math.max(0, plan.quantity - already);
        const reqSum = lines.reduce((s, l) => s + l.qty, 0);
        if (reqSum > remain + 1e-9) {
          return NextResponse.json(
            { error: `미출하 수량을 초과했어요. 미출하 ${remain}, 요청 ${reqSum}` },
            { status: 400 }
          );
        }
      }
    }

    const slipNo =
      (body.slipNo && String(body.slipNo).trim()) ||
      (await allocateSlipNo("shipment", dateStr));

    const warehouseName = body.warehouseName
      ? String(body.warehouseName).trim()
      : null;
    const manager = body.manager ? String(body.manager).trim() : null;
    const memo = body.memo ? String(body.memo).trim() : null;
    const vendorCode = body.vendorCode ? String(body.vendorCode).trim() : null;
    const vendorName = body.vendorName ? String(body.vendorName).trim() : null;

    const created = await prisma.$transaction(async (tx) => {
      // Re-check balances inside transaction
      for (const line of lines) {
        const bal = await tx.stockBalance.findUnique({
          where: {
            workspaceId_warehouseCode_itemCode: {
              workspaceId: DEMO_WORKSPACE_ID,
              warehouseCode,
              itemCode: line.itemCode,
            },
          },
        });
        const qty = bal?.qty ?? 0;
        if (line.qty > qty + 1e-9) {
          throw new Error(
            `재고가 부족해요. [${line.itemCode}] 현재고 ${qty}, 요청 ${line.qty}`
          );
        }
      }

      const movements = [];
      for (const line of lines) {
        const signed = -Math.abs(line.qty);
        const m = await tx.stockMovement.create({
          data: {
            workspaceId: DEMO_WORKSPACE_ID,
            date,
            type: "shipment",
            slipNo,
            warehouseCode,
            warehouseName,
            itemCode: line.itemCode,
            itemName: line.itemName ?? null,
            itemSpec: line.itemSpec ?? null,
            itemUnit: line.itemUnit ?? null,
            qty: signed,
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
          delta: signed,
        });
        movements.push(m);
      }

      let outboundStatus: ReturnType<typeof outboundFromQtys> | undefined;
      if (relatedType === "salesPlan" && relatedId) {
        const plan = await tx.salesPlan.findFirst({
          where: { id: relatedId, workspaceId: DEMO_WORKSPACE_ID },
        });
        if (plan) {
          const agg = await tx.stockMovement.aggregate({
            where: {
              workspaceId: DEMO_WORKSPACE_ID,
              relatedType: "salesPlan",
              relatedId,
              type: "shipment",
            },
            _sum: { qty: true },
          });
          const shippedAbs = Math.abs(agg._sum.qty ?? 0);
          outboundStatus = outboundFromQtys(plan.quantity, shippedAbs);
          await tx.salesPlan.update({
            where: { id: plan.id },
            data: { outboundStatus },
          });
        }
      }

      return { movements, outboundStatus };
    });

    let relatedShippedQty = 0;
    if (relatedType && relatedId) {
      relatedShippedQty = await sumRelatedQty({
        relatedType,
        relatedId,
        type: "shipment",
      });
    }

    return NextResponse.json(
      {
        slipNo,
        movements: created.movements.map(serializeMovement),
        relatedShippedQty,
        outboundStatus: created.outboundStatus,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "출하 저장에 실패했어요.";
    console.error("POST /api/inventory/shipments", e);
    const status = msg.includes("부족") || msg.includes("초과") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

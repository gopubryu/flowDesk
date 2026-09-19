import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  allocateSlipNoTx,
  applyBalanceDelta,
  assertMasterItemCode,
  getBalanceQty,
  listSlipsByType,
  num,
  outboundFromQtys,
  parseDateOnly,
  serializeMovement,
  serializableInventoryTransaction,
  sumRelatedQty,
  validateRegisteredItemCodes,
} from "@/lib/inventory-server";
import { aggregateQtyByItem, groupRelatedLines, validateMovementQuantity } from "@/lib/erp-rules";

export const dynamic = "force-dynamic";

type LineInput = {
  itemCode?: string;
  itemName?: string;
  itemSpec?: string;
  itemUnit?: string;
  qty?: number | string;
  memo?: string;
  relatedType?: string;
  relatedId?: string;
};


/** List shipment slips grouped from movements */
export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const slips = await listSlipsByType("shipment", workspaceId);
    return NextResponse.json(slips);
  } catch (e) {
    const auth = authError(e); if (auth) return auth;
    console.error("GET /api/inventory/shipments", e);
    return NextResponse.json({ error: "출하 조회에 실패했어요." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(body.workspaceId, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
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
    const malformedLine = rawLines.find((line) => {
      const hasContent = Boolean(line.itemCode?.trim()) || line.qty !== undefined;
      return hasContent && validateMovementQuantity(line.qty) !== null;
    });
    if (malformedLine) {
      return NextResponse.json({ error: validateMovementQuantity(malformedLine.qty) }, { status: 400 });
    }
    const lines = rawLines
      .map((l) => ({
        itemCode: String(l.itemCode ?? "").trim(),
        itemName: l.itemName ? String(l.itemName).trim() : undefined,
        itemSpec: l.itemSpec ? String(l.itemSpec).trim() : undefined,
        itemUnit: l.itemUnit ? String(l.itemUnit).trim() : undefined,
        qty: num(l.qty),
        memo: l.memo ? String(l.memo).trim() : undefined,
        relatedType: l.relatedType ? String(l.relatedType) : (body.relatedType ? String(body.relatedType) : null),
        relatedId: l.relatedId ? String(l.relatedId) : (body.relatedId ? String(body.relatedId) : null),
      }))
      .filter((l) => l.itemCode && l.qty > 0);

    for (const line of lines) {
      const bad = assertMasterItemCode(line.itemCode);
      if (bad) {
        return NextResponse.json({ error: bad }, { status: 400 });
      }
    }
    const unknownItem = await validateRegisteredItemCodes(lines.map((line) => line.itemCode), workspaceId);
    if (unknownItem) {
      return NextResponse.json({ error: unknownItem }, { status: 400 });
    }

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "이번출하 수량이 0보다 큰 품목을 입력해 주세요." },
        { status: 400 }
      );
    }

    // Insufficient stock check (no negative outbound)
    for (const [itemCode, requested] of aggregateQtyByItem(lines)) {
      const line = { itemCode, qty: requested };
      const bal = await getBalanceQty(workspaceId, warehouseCode, itemCode);
      if (requested > bal + 1e-9) {
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
        where: { id: relatedId, workspaceId: workspaceId },
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
        workspaceId,
        relatedType: "salesPlan",
        relatedId,
        type: "shipment",
      });
      // Per-item remaining if lines exist
      if (plan.lines.length > 0) {
        const plannedByItem = aggregateQtyByItem(
          plan.lines
            .filter((line) => Boolean(line.itemCode))
            .map((line) => ({ itemCode: line.itemCode!, qty: line.qty }))
        );
        const requestedByItem = aggregateQtyByItem(lines);
        const shippedByItem = await prisma.stockMovement.groupBy({
          by: ["itemCode"],
          where: {
            workspaceId: workspaceId,
            relatedType: "salesPlan",
            relatedId,
            type: "shipment",
          },
          _sum: { qty: true },
        });
        const shippedMap = new Map(
          shippedByItem.map((r) => [r.itemCode, Math.abs(r._sum.qty ?? 0)])
        );
        for (const [itemCode, requested] of requestedByItem) {
          const planQty = plannedByItem.get(itemCode) ?? 0;
          const shipped = shippedMap.get(itemCode) ?? 0;
          const remain = Math.max(0, planQty - shipped);
          if (requested > remain + 1e-9) {
            return NextResponse.json(
              {
                error: `미출하 수량을 초과했어요. [${itemCode}] 미출하 ${remain}, 요청 ${requested}`,
              },
              { status: 400 }
            );
          }
        }
      } else {
        if (!plan.itemCode || [...aggregateQtyByItem(lines).keys()].some((itemCode) => itemCode !== plan.itemCode)) {
          return NextResponse.json({ error: "Unknown item code for linked sales plan." }, { status: 400 });
        }
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


    const warehouseName = body.warehouseName
      ? String(body.warehouseName).trim()
      : null;
    const manager = body.manager ? String(body.manager).trim() : null;
    const memo = body.memo ? String(body.memo).trim() : null;
    const vendorCode = body.vendorCode ? String(body.vendorCode).trim() : null;
    const vendorName = body.vendorName ? String(body.vendorName).trim() : null;

    const created = await serializableInventoryTransaction(async (tx) => {
      const slipNo = await allocateSlipNoTx(tx, "shipment", dateStr, workspaceId);
      // Linked plan limits are rechecked with the movement, not merely before it.
      for (const [key, requestedByItem] of groupRelatedLines(lines)) {
        const [lineRelatedType, lineRelatedId] = key.split(":", 2);
        if (lineRelatedType !== "salesPlan") continue;
        const plan = await tx.salesPlan.findFirst({ where: { id: lineRelatedId, workspaceId: workspaceId }, include: { lines: true } });
        if (!plan || !["confirmed", "in_progress"].includes(plan.status)) throw new Error("Linked sales plan is not available for shipment.");
        const shipped = await tx.stockMovement.groupBy({ by: ["itemCode"], where: { workspaceId: workspaceId, relatedType: "salesPlan", relatedId: lineRelatedId, type: "shipment" }, _sum: { qty: true } });
        const shippedByItem = new Map(shipped.map((row) => [row.itemCode, Math.abs(row._sum.qty ?? 0)]));
        for (const [itemCode, requested] of requestedByItem) {
          const planned = plan.lines.length
            ? plan.lines.filter((line) => line.itemCode === itemCode).reduce((sum, line) => sum + line.qty, 0)
            : plan.itemCode === itemCode ? plan.quantity : 0;
          const remaining = planned - (shippedByItem.get(itemCode) ?? 0);
          if (planned <= 0 || requested > remaining + 1e-9) throw new Error(`Shipment exceeds remaining quantity for ${itemCode}.`);
        }
      }
      // Re-check balances inside transaction
      for (const [itemCode, requested] of aggregateQtyByItem(lines)) {
        const line = { itemCode, qty: requested };
        const bal = await tx.stockBalance.findUnique({
          where: {
            workspaceId_warehouseCode_itemCode: {
              workspaceId: workspaceId,
              warehouseCode,
              itemCode,
            },
          },
        });
        const qty = bal?.qty ?? 0;
        if (requested > qty + 1e-9) {
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
            workspaceId: workspaceId,
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
            relatedType: line.relatedType,
            relatedId: line.relatedId,
            memo: line.memo || memo,
            manager,
            vendorCode,
            vendorName,
          },
        });
        await applyBalanceDelta(tx, {
          workspaceId,
          warehouseCode,
          warehouseName,
          itemCode: line.itemCode,
          itemName: line.itemName,
          delta: signed,
        });
        movements.push(m);
      }

      let outboundStatus: ReturnType<typeof outboundFromQtys> | undefined;
      for (const [key] of groupRelatedLines(lines)) {
        const [lineRelatedType, lineRelatedId] = key.split(":", 2);
        if (lineRelatedType !== "salesPlan") continue;
        const plan = await tx.salesPlan.findFirst({
          where: { id: lineRelatedId, workspaceId: workspaceId },
        });
        if (plan) {
          const agg = await tx.stockMovement.aggregate({
            where: {
              workspaceId: workspaceId,
              relatedType: "salesPlan",
              relatedId: lineRelatedId,
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

      return { movements, outboundStatus, slipNo };
    });

    let relatedShippedQty = 0;
    if (relatedType && relatedId) {
      relatedShippedQty = await sumRelatedQty({
        workspaceId,
        relatedType,
        relatedId,
        type: "shipment",
      });
    }

    return NextResponse.json(
      {
        slipNo: created.slipNo,
        movements: created.movements.map(serializeMovement),
        relatedShippedQty,
        outboundStatus: created.outboundStatus,
      },
      { status: 201 }
    );
  } catch (e) {
    const auth = authError(e); if (auth) return auth;
    const msg = e instanceof Error ? e.message : "출하 저장에 실패했어요.";
    console.error("POST /api/inventory/shipments", e);
    if (msg.startsWith("Shipment exceeds") || msg.startsWith("Linked sales plan")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    const status = msg.includes("부족") || msg.includes("초과") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { NextResponse } from "next/server";
import {
  allocateSlipNoTx,
  applyBalanceDelta,
  assertMasterItemCode,
  getBalanceQty,
  listSlipsByType,
  parseDateOnly,
  serializeMovement,
  serializableInventoryTransaction,
} from "@/lib/inventory-server";
import { adjustmentDelta, validDateOnly } from "@/lib/erp-rules";

export const dynamic = "force-dynamic";

/** List adjustment slips grouped from movements */
export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const slips = await listSlipsByType("adjustment", workspaceId);
    return NextResponse.json(slips);
  } catch (e) {
    const auth = authError(e); if (auth) return auth;
    console.error("GET /api/inventory/adjustments", e);
    return NextResponse.json({ error: "조정 조회에 실패했어요." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(body.workspaceId, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const warehouseCode = String(body.warehouseCode ?? "").trim();
    const itemCode = String(body.itemCode ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    if (!warehouseCode) {
      return NextResponse.json({ error: "창고는 필수예요." }, { status: 400 });
    }
    if (!itemCode) {
      return NextResponse.json({ error: "품목은 필수예요." }, { status: 400 });
    }
    const badCode = assertMasterItemCode(itemCode);
    if (badCode) {
      return NextResponse.json({ error: badCode }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "조정 사유는 필수예요." }, { status: 400 });
    }
    const dateStr = String(body.date ?? "").trim();
    if (!validDateOnly(dateStr)) return NextResponse.json({ error: "Invalid adjustment date." }, { status: 400 });
    const date = parseDateOnly(dateStr)!;
    const dateKey =
      dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
        ? dateStr
        : date.toISOString().slice(0, 10);

    const serverBookQty = await getBalanceQty(workspaceId, warehouseCode, itemCode);
    const clientBookQty = body.bookQty !== undefined && body.bookQty !== null ? Number(body.bookQty) : undefined;
    const rawActualQty = Number(body.actualQty);
    const adjustment = adjustmentDelta(serverBookQty, rawActualQty, clientBookQty);
    if (adjustment.error) return NextResponse.json({ error: adjustment.error }, { status: adjustment.conflict ? 409 : 400 });
    const delta = adjustment.delta!;
    if (Math.abs(delta) < 1e-9) {
      return NextResponse.json(
        { error: "장부수량과 실사수량이 같아 조정이 필요 없어요." },
        { status: 400 }
      );
    }


    const warehouseName = body.warehouseName
      ? String(body.warehouseName).trim()
      : null;
    const itemName = body.itemName ? String(body.itemName).trim() : null;
    const manager = body.manager ? String(body.manager).trim() : null;

    const movement = await serializableInventoryTransaction(async (tx) => {
      const slipNo = await allocateSlipNoTx(tx, "adjustment", dateKey, workspaceId);
      const current = await tx.stockBalance.findUnique({ where: { workspaceId_warehouseCode_itemCode: { workspaceId: workspaceId, warehouseCode, itemCode } } });
      const currentAdjustment = adjustmentDelta(current?.qty ?? 0, rawActualQty, clientBookQty);
      if (currentAdjustment.error) throw Object.assign(new Error(currentAdjustment.error), { conflict: currentAdjustment.conflict });
      const transactionDelta = currentAdjustment.delta!;
      const m = await tx.stockMovement.create({
        data: {
          workspaceId: workspaceId,
          date,
          type: "adjustment",
          slipNo,
          warehouseCode,
          warehouseName,
          itemCode,
          itemName,
          qty: transactionDelta,
          memo: reason,
          manager,
        },
      });
      await applyBalanceDelta(tx, {
          workspaceId,
        warehouseCode,
        warehouseName,
        itemCode,
        itemName,
        delta: transactionDelta,
      });
      return { movement: m, slipNo };
    });

    return NextResponse.json(
      { slipNo: movement.slipNo, movement: serializeMovement(movement.movement) },
      { status: 201 }
    );
  } catch (e) {
    const auth = authError(e); if (auth) return auth;
    console.error("POST /api/inventory/adjustments", e);
    const error = e as Error & { conflict?: boolean };
    if (error.conflict) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "조정 저장에 실패했어요." }, { status: 500 });
  }
}

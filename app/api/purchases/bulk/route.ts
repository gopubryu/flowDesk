import { NextResponse } from "next/server";
import type { PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializePurchase } from "@/lib/demo";
import { canDeletePurchase, canTransitionPurchase } from "@/lib/erp-rules";
import { serializableInventoryTransaction } from "@/lib/inventory-server";
import { bodyWorkspaceId, authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

function ids(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const selected = ids(body.ids);
    const status = body.status as PurchaseStatus;
    if (!selected.length || !["approval", "unconfirmed", "confirmed"].includes(status)) {
      return NextResponse.json({ error: "Select purchases and a valid status." }, { status: 400 });
    }
    const rows = await serializableInventoryTransaction(async (tx) => {
      const current = await tx.purchase.findMany({ where: { workspaceId: workspaceId, id: { in: selected } } });
      if (current.length !== selected.length) throw new Error("One or more purchases no longer exist.");
      const blocked = current.find((row) => !canTransitionPurchase(row.status, status));
      if (blocked) throw new Error(`Purchase ${blocked.slipNo ?? blocked.id} cannot move from ${blocked.status} to ${status}.`);
      await tx.purchase.updateMany({ where: { workspaceId: workspaceId, id: { in: selected } }, data: { status } });
      return tx.purchase.findMany({ where: { workspaceId: workspaceId, id: { in: selected }, }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
    });
    return NextResponse.json(rows.map(serializePurchase));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : "Could not change purchase status." }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN]);
    const selected = ids(body.ids);
    if (!selected.length) return NextResponse.json({ error: "Select purchases to delete." }, { status: 400 });
    await serializableInventoryTransaction(async (tx) => {
      const current = await tx.purchase.findMany({ where: { workspaceId: workspaceId, id: { in: selected } } });
      if (current.length !== selected.length) throw new Error("One or more purchases no longer exist.");
      const receiptCounts = await tx.stockMovement.groupBy({ by: ["relatedId"], where: { workspaceId: workspaceId, relatedType: "purchase", type: "receipt", relatedId: { in: selected } }, _count: { _all: true } });
      const receivedIds = new Set(receiptCounts.map((row) => row.relatedId));
      const blocked = current.find((row) => !canDeletePurchase(row.status, row.inboundStatus) || receivedIds.has(row.id));
      if (blocked) throw new Error(`Purchase ${blocked.slipNo ?? blocked.id} has receipts and cannot be deleted.`);
      await tx.purchase.deleteMany({ where: { workspaceId: workspaceId, id: { in: selected } } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete purchases." }, { status: 409 });
  }
}

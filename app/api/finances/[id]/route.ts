import { NextResponse } from "next/server";
import type { FinanceCategory, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, serializeFinance } from "@/lib/demo";
import { authError, bodyWorkspaceId } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(
      bodyWorkspaceId(body),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR],
    );
    const data: Record<string, unknown> = {};
    if (body.client !== undefined) data.client = String(body.client);
    if (body.description !== undefined) data.description = String(body.description);
    if (body.amount !== undefined) data.amount = Number(body.amount) || 0;
    if (body.status !== undefined) data.status = body.status as PaymentStatus;
    if (body.date !== undefined) data.date = parseDateOnly(body.date) ?? undefined;
    if (body.dueDate !== undefined) data.dueDate = parseDateOnly(body.dueDate);
    if (body.category !== undefined) data.category = body.category as FinanceCategory;

    const result = await prisma.financeRecord.updateMany({
      where: { id, workspaceId },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await prisma.financeRecord.findFirstOrThrow({ where: { id, workspaceId } });
    return NextResponse.json(serializeFinance(updated));
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Failed to update finance" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    const resolved = await requireResolvedWorkspace(workspaceId, [WorkspaceRole.ADMIN]);
    const result = await prisma.financeRecord.deleteMany({
      where: { id, workspaceId: resolved.workspaceId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Failed to delete finance" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { FinanceCategory, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, parseDateOnly, serializeFinance } from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.client !== undefined) data.client = String(body.client);
    if (body.description !== undefined) data.description = String(body.description);
    if (body.amount !== undefined) data.amount = Number(body.amount) || 0;
    if (body.status !== undefined) data.status = body.status as PaymentStatus;
    if (body.date !== undefined) data.date = parseDateOnly(body.date) ?? undefined;
    if (body.dueDate !== undefined) data.dueDate = parseDateOnly(body.dueDate);
    if (body.category !== undefined) data.category = body.category as FinanceCategory;

    const result = await prisma.financeRecord.updateMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await prisma.financeRecord.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(serializeFinance(updated));
  } catch (e) {
    console.error("PATCH /api/finances/[id]", e);
    return NextResponse.json({ error: "Failed to update finance" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await prisma.financeRecord.deleteMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/finances/[id]", e);
    return NextResponse.json({ error: "Failed to delete finance" }, { status: 500 });
  }
}

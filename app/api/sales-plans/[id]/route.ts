import { NextResponse } from "next/server";
import type { SalesPlanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  parseDateOnly,
  serializeSalesPlan,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const row = await prisma.salesPlan.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializeSalesPlan(row));
  } catch (e) {
    console.error("GET /api/sales-plans/[id]", e);
    return NextResponse.json(
      { error: "Failed to load sales plan" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.salesPlan.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.planDate !== undefined) {
      data.planDate = parseDateOnly(body.planDate) ?? existing.planDate;
    }
    if (body.vendorCode !== undefined) {
      data.vendorCode = body.vendorCode ? String(body.vendorCode) : null;
    }
    if (body.vendorName !== undefined || body.vendor !== undefined) {
      data.vendorName =
        String(body.vendorName ?? body.vendor ?? "").trim() || existing.vendorName;
    }
    if (body.item !== undefined) data.item = String(body.item);
    if (body.itemCode !== undefined) {
      data.itemCode = body.itemCode ? String(body.itemCode) : null;
    }
    if (body.spec !== undefined) {
      data.spec = body.spec ? String(body.spec) : null;
    }
    if (body.quantity !== undefined) data.quantity = num(body.quantity);
    if (body.unitPrice !== undefined) data.unitPrice = num(body.unitPrice);
    if (body.amount !== undefined) data.amount = num(body.amount);
    if (body.vat !== undefined) data.vat = num(body.vat);
    if (body.total !== undefined) data.total = num(body.total);
    if (body.status !== undefined) {
      data.status = body.status as SalesPlanStatus;
    }
    if (body.lastModifier !== undefined) {
      data.lastModifier = body.lastModifier ? String(body.lastModifier) : null;
    }
    if (body.closed !== undefined) data.closed = Boolean(body.closed);
    if (body.manager !== undefined) {
      data.manager = body.manager ? String(body.manager) : null;
    }
    if (body.taxType !== undefined) {
      data.taxType = body.taxType ? String(body.taxType) : null;
    }
    if (body.warehouse !== undefined) {
      data.warehouse = body.warehouse ? String(body.warehouse) : null;
    }
    if (body.project !== undefined) {
      data.project = body.project ? String(body.project) : null;
    }
    if (body.currency !== undefined) {
      data.currency = body.currency ? String(body.currency) : null;
    }
    if (body.dueDate !== undefined) {
      data.dueDate = parseDateOnly(body.dueDate);
    }

    const updated = await prisma.salesPlan.update({
      where: { id },
      data,
    });
    return NextResponse.json(serializeSalesPlan(updated));
  } catch (e) {
    console.error("PATCH /api/sales-plans/[id]", e);
    return NextResponse.json(
      { error: "Failed to update sales plan" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.salesPlan.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.salesPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/sales-plans/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete sales plan" },
      { status: 500 }
    );
  }
}

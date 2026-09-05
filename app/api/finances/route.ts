import { NextResponse } from "next/server";
import type { FinanceCategory, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  ensureDemoWorkspace,
  parseDateOnly,
  serializeFinance,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDemoWorkspace();
    const finances = await prisma.financeRecord.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(finances.map(serializeFinance));
  } catch (e) {
    console.error("GET /api/finances", e);
    return NextResponse.json({ error: "Failed to load finances" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDemoWorkspace();
    const body = await req.json();
    const record = await prisma.financeRecord.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
        client: String(body.client ?? ""),
        description: String(body.description ?? ""),
        amount: Number(body.amount) || 0,
        status: (body.status as PaymentStatus) ?? "pending",
        date: parseDateOnly(body.date) ?? new Date(),
        dueDate: parseDateOnly(body.dueDate),
        category: (body.category as FinanceCategory) ?? "sales",
      },
    });
    return NextResponse.json(serializeFinance(record), { status: 201 });
  } catch (e) {
    console.error("POST /api/finances", e);
    return NextResponse.json({ error: "Failed to create finance" }, { status: 500 });
  }
}

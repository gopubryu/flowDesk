import { NextResponse } from "next/server";
import type { FinanceCategory, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseDateOnly,
  serializeFinance,
} from "@/lib/demo";
import { authError, bodyWorkspaceId } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER],
    );
    const finances = await prisma.financeRecord.findMany({
      where: { workspaceId },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(finances.map(serializeFinance));
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Failed to load finances" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(
      bodyWorkspaceId(body),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR],
    );
    const record = await prisma.financeRecord.create({
      data: {
        workspaceId,
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
    return authError(e) ?? NextResponse.json({ error: "Failed to create finance" }, { status: 500 });
  }
}

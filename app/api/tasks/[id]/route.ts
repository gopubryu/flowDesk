import { NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { parseDateOnly, serializeTask } from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER],
    );
    const task = await prisma.task.findFirst({ where: { id, workspaceId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeTask(task));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to load task" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(body?.workspaceId, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) data.title = String(body.title);
    if (body.description !== undefined) data.description = body.description ?? null;
    if (body.status !== undefined) data.status = body.status as TaskStatus;
    if (body.priority !== undefined) data.priority = body.priority as TaskPriority;
    if (body.dueDate !== undefined) data.dueDate = parseDateOnly(body.dueDate);
    if (body.assignee !== undefined) data.assignee = body.assignee ?? null;

    const result = await prisma.task.updateMany({ where: { id, workspaceId }, data });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await prisma.task.findFirstOrThrow({ where: { id, workspaceId } });
    return NextResponse.json(serializeTask(updated));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN],
    );
    const result = await prisma.task.deleteMany({ where: { id, workspaceId } });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}

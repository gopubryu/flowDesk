import { NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, parseDateOnly, serializeTask } from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) data.title = String(body.title);
    if (body.description !== undefined) data.description = body.description ?? null;
    if (body.status !== undefined) data.status = body.status as TaskStatus;
    if (body.priority !== undefined) data.priority = body.priority as TaskPriority;
    if (body.dueDate !== undefined) data.dueDate = parseDateOnly(body.dueDate);
    if (body.assignee !== undefined) data.assignee = body.assignee ?? null;

    const task = await prisma.task.updateMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
      data,
    });
    if (task.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await prisma.task.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(serializeTask(updated));
  } catch (e) {
    console.error("PATCH /api/tasks/[id]", e);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await prisma.task.deleteMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/tasks/[id]", e);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}

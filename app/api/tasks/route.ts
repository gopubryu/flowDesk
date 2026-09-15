import { NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { parseDateOnly, serializeTask } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER],
    );
    const tasks = await prisma.task.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(tasks.map(serializeTask));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(body?.workspaceId, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const now = new Date();
    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: String(body.title ?? ""),
        description: body.description ?? null,
        status: (body.status as TaskStatus) ?? "todo",
        priority: (body.priority as TaskPriority) ?? "medium",
        dueDate: parseDateOnly(body.dueDate),
        assignee: body.assignee ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return NextResponse.json(serializeTask(task), { status: 201 });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

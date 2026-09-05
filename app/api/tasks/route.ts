import { NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  ensureDemoWorkspace,
  parseDateOnly,
  serializeTask,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDemoWorkspace();
    const tasks = await prisma.task.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tasks.map(serializeTask));
  } catch (e) {
    console.error("GET /api/tasks", e);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDemoWorkspace();
    const body = await req.json();
    const now = new Date();
    const task = await prisma.task.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
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
  } catch (e) {
    console.error("POST /api/tasks", e);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

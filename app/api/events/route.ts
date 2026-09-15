import { NextResponse } from "next/server";
import type { EventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { parseDateOnly, serializeEvent } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER],
    );
    const events = await prisma.calendarEvent.findMany({
      where: { workspaceId },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(events.map(serializeEvent));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(body?.workspaceId, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const event = await prisma.calendarEvent.create({
      data: {
        workspaceId,
        title: String(body.title ?? ""),
        description: body.description ?? null,
        date: parseDateOnly(body.date) ?? new Date(),
        endDate: parseDateOnly(body.endDate),
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        allDay: Boolean(body.allDay),
        type: (body.type as EventType) ?? "other",
        company: body.company ?? null,
        location: body.location ?? null,
        project: body.project ?? null,
        attendees: Array.isArray(body.attendees) ? body.attendees.map(String) : [],
      },
    });
    return NextResponse.json(serializeEvent(event), { status: 201 });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

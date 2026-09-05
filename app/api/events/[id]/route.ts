import { NextResponse } from "next/server";
import type { EventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, parseDateOnly, serializeEvent } from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title);
    if (body.description !== undefined) data.description = body.description ?? null;
    if (body.date !== undefined) data.date = parseDateOnly(body.date) ?? undefined;
    if (body.endDate !== undefined) data.endDate = parseDateOnly(body.endDate);
    if (body.startTime !== undefined) data.startTime = body.startTime ?? null;
    if (body.endTime !== undefined) data.endTime = body.endTime ?? null;
    if (body.allDay !== undefined) data.allDay = Boolean(body.allDay);
    if (body.type !== undefined) data.type = body.type as EventType;
    if (body.company !== undefined) data.company = body.company ?? null;
    if (body.location !== undefined) data.location = body.location ?? null;
    if (body.project !== undefined) data.project = body.project ?? null;
    if (body.attendees !== undefined) {
      data.attendees = Array.isArray(body.attendees) ? body.attendees.map(String) : [];
    }

    const result = await prisma.calendarEvent.updateMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await prisma.calendarEvent.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(serializeEvent(updated));
  } catch (e) {
    console.error("PATCH /api/events/[id]", e);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await prisma.calendarEvent.deleteMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/events/[id]", e);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}

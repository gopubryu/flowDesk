import { NextResponse } from "next/server";
import type { EventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  ensureDemoWorkspace,
  parseDateOnly,
  serializeEvent,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDemoWorkspace();
    const events = await prisma.calendarEvent.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(events.map(serializeEvent));
  } catch (e) {
    console.error("GET /api/events", e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDemoWorkspace();
    const body = await req.json();
    const event = await prisma.calendarEvent.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
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
  } catch (e) {
    console.error("POST /api/events", e);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

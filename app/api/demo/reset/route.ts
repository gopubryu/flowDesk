import { NextResponse } from "next/server";
import { wipeAndSeedDemoWorkspace } from "@/lib/seed-demo";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  serializeEvent,
  serializeFinance,
  serializeMail,
  serializeTask,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NEXT_PUBLIC_ALLOW_DEMO_RESET !== "true") {
    return NextResponse.json({ error: "Demo reset is disabled" }, { status: 404 });
  }

  try {
    const result = await wipeAndSeedDemoWorkspace();
    const [tasks, events, finances, mails] = await Promise.all([
      prisma.task.findMany({
        where: { workspaceId: DEMO_WORKSPACE_ID },
        orderBy: { createdAt: "desc" },
      }),
      prisma.calendarEvent.findMany({
        where: { workspaceId: DEMO_WORKSPACE_ID },
        orderBy: { date: "asc" },
      }),
      prisma.financeRecord.findMany({
        where: { workspaceId: DEMO_WORKSPACE_ID },
        orderBy: { date: "desc" },
      }),
      prisma.mailMessage.findMany({
        where: { workspaceId: DEMO_WORKSPACE_ID },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return NextResponse.json({
      ...result,
      tasks: tasks.map(serializeTask),
      events: events.map(serializeEvent),
      finances: finances.map(serializeFinance),
      mails: mails.map(serializeMail),
    });
  } catch (e) {
    console.error("POST /api/demo/reset", e);
    return NextResponse.json({ error: "Failed to reset demo" }, { status: 500 });
  }
}

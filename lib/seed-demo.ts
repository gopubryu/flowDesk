import {
  type EventType,
  type FinanceCategory,
  type MailFolder,
  type PaymentStatus,
  type TaskPriority,
  type TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_NAME,
  parseDateOnly,
  parseDateTime,
} from "@/lib/demo";
import {
  initialEvents,
  initialFinances,
  initialMails,
  initialTasks,
} from "@/lib/mock-data";

export async function wipeAndSeedDemoWorkspace() {
  await prisma.workspace.upsert({
    where: { id: DEMO_WORKSPACE_ID },
    update: { name: DEMO_WORKSPACE_NAME },
    create: { id: DEMO_WORKSPACE_ID, name: DEMO_WORKSPACE_NAME },
  });

  await prisma.$transaction([
    prisma.task.deleteMany({ where: { workspaceId: DEMO_WORKSPACE_ID } }),
    prisma.calendarEvent.deleteMany({ where: { workspaceId: DEMO_WORKSPACE_ID } }),
    prisma.financeRecord.deleteMany({ where: { workspaceId: DEMO_WORKSPACE_ID } }),
    prisma.mailMessage.deleteMany({ where: { workspaceId: DEMO_WORKSPACE_ID } }),
  ]);

  await prisma.task.createMany({
    data: initialTasks.map((t) => ({
      id: t.id,
      workspaceId: DEMO_WORKSPACE_ID,
      title: t.title,
      description: t.description ?? null,
      status: t.status as TaskStatus,
      priority: t.priority as TaskPriority,
      dueDate: parseDateOnly(t.dueDate),
      assignee: t.assignee ?? null,
      createdAt: parseDateTime(t.createdAt) ?? new Date(),
      updatedAt: parseDateTime(t.updatedAt) ?? new Date(),
    })),
  });

  await prisma.calendarEvent.createMany({
    data: initialEvents.map((e) => ({
      id: e.id,
      workspaceId: DEMO_WORKSPACE_ID,
      title: e.title,
      description: e.description ?? null,
      date: parseDateOnly(e.date)!,
      endDate: parseDateOnly(e.endDate),
      startTime: e.startTime ?? null,
      endTime: e.endTime ?? null,
      allDay: e.allDay ?? false,
      type: e.type as EventType,
      company: e.company ?? null,
      location: e.location ?? null,
      project: e.project ?? null,
      attendees: e.attendees ?? [],
    })),
  });

  await prisma.financeRecord.createMany({
    data: initialFinances.map((f) => ({
      id: f.id,
      workspaceId: DEMO_WORKSPACE_ID,
      client: f.client,
      description: f.description,
      amount: f.amount,
      status: f.status as PaymentStatus,
      date: parseDateOnly(f.date)!,
      dueDate: parseDateOnly(f.dueDate),
      category: f.category as FinanceCategory,
    })),
  });

  await prisma.mailMessage.createMany({
    data: initialMails.map((m) => ({
      id: m.id,
      workspaceId: DEMO_WORKSPACE_ID,
      folder: m.folder as MailFolder,
      from: m.from,
      to: m.to,
      cc: m.cc ?? null,
      subject: m.subject,
      body: m.body,
      snippet: m.snippet ?? null,
      starred: m.starred,
      read: m.read,
      createdAt: parseDateTime(m.createdAt) ?? new Date(),
      previousFolder: (m.previousFolder as MailFolder | undefined) ?? null,
    })),
  });

  const counts = {
    tasks: initialTasks.length,
    events: initialEvents.length,
    finances: initialFinances.length,
    mails: initialMails.length,
  };

  return { workspaceId: DEMO_WORKSPACE_ID, ...counts };
}


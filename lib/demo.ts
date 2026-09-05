import { prisma } from "@/lib/prisma";

export const DEMO_WORKSPACE_ID = "demo-workspace";
export const DEMO_WORKSPACE_NAME = "플로우데스크 데모";

export async function ensureDemoWorkspace() {
  return prisma.workspace.upsert({
    where: { id: DEMO_WORKSPACE_ID },
    update: { name: DEMO_WORKSPACE_NAME },
    create: { id: DEMO_WORKSPACE_ID, name: DEMO_WORKSPACE_NAME },
  });
}

/** Format a Date as YYYY-MM-DD (UTC calendar date). */
export function toDateString(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

export function toIsoString(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toISOString();
}

/** Parse YYYY-MM-DD or ISO into Date at UTC noon to avoid TZ edge cases for date-only. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00.000Z`);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function serializeTask(t: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    status: t.status,
    priority: t.priority,
    dueDate: toDateString(t.dueDate),
    assignee: t.assignee ?? undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeEvent(e: {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  type: string;
  company: string | null;
  location: string | null;
  project: string | null;
  attendees: string[];
}) {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    date: toDateString(e.date)!,
    endDate: toDateString(e.endDate),
    startTime: e.startTime ?? undefined,
    endTime: e.endTime ?? undefined,
    allDay: e.allDay || undefined,
    type: e.type,
    company: e.company ?? undefined,
    location: e.location ?? undefined,
    project: e.project ?? undefined,
    attendees: e.attendees?.length ? e.attendees : undefined,
  };
}

export function serializeFinance(f: {
  id: string;
  client: string;
  description: string;
  amount: number;
  status: string;
  date: Date;
  dueDate: Date | null;
  category: string;
}) {
  return {
    id: f.id,
    client: f.client,
    description: f.description,
    amount: f.amount,
    status: f.status,
    date: toDateString(f.date)!,
    dueDate: toDateString(f.dueDate),
    category: f.category,
  };
}

export function serializeMail(m: {
  id: string;
  folder: string;
  from: string;
  to: string;
  cc: string | null;
  subject: string;
  body: string;
  snippet: string | null;
  starred: boolean;
  read: boolean;
  createdAt: Date;
  previousFolder: string | null;
}) {
  return {
    id: m.id,
    folder: m.folder,
    from: m.from,
    to: m.to,
    cc: m.cc ?? undefined,
    subject: m.subject,
    body: m.body,
    snippet: m.snippet ?? undefined,
    starred: m.starred,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
    previousFolder: m.previousFolder ?? undefined,
  };
}

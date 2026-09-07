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


/** Parse numeric sequence from slipNo ("0003" or "2026-09-06-0003"). */
export function parseSlipSeq(slipNo: string | null | undefined): number {
  if (!slipNo) return 0;
  const trimmed = String(slipNo).trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const m = /-(\d+)$/.exec(trimmed);
  return m ? Number(m[1]) : 0;
}

export function formatSlipSeq(n: number): string {
  return String(Math.max(1, n)).padStart(4, "0");
}

/** Next daily slip sequence (0001…) for workspace + request date (UTC YMD). */
export async function allocateNextSlipNo(
  workspaceId: string,
  requestDate: Date
): Promise<string> {
  const ymd = toDateString(requestDate)!;
  const dayStart = new Date(`${ymd}T00:00:00.000Z`);
  const dayEnd = new Date(`${ymd}T23:59:59.999Z`);
  const rows = await prisma.purchaseRequest.findMany({
    where: {
      workspaceId,
      requestDate: { gte: dayStart, lte: dayEnd },
      NOT: [{ slipNo: null }, { slipNo: "" }],
    },
    select: { slipNo: true },
  });
  let max = 0;
  for (const r of rows) {
    max = Math.max(max, parseSlipSeq(r.slipNo));
  }
  return formatSlipSeq(max + 1);
}

/** Assign daily sequential slipNos to rows missing one (idempotent). */
export async function backfillMissingPurchaseRequestSlipNos(
  workspaceId: string
): Promise<number> {
  const missing = await prisma.purchaseRequest.findMany({
    where: {
      workspaceId,
      OR: [{ slipNo: null }, { slipNo: "" }],
    },
    orderBy: [{ requestDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, requestDate: true },
  });
  if (missing.length === 0) return 0;

  const dayMax = new Map<string, number>();
  const assigned = await prisma.purchaseRequest.findMany({
    where: {
      workspaceId,
      NOT: [{ slipNo: null }, { slipNo: "" }],
    },
    select: { requestDate: true, slipNo: true },
  });
  for (const r of assigned) {
    const ymd = toDateString(r.requestDate)!;
    dayMax.set(ymd, Math.max(dayMax.get(ymd) ?? 0, parseSlipSeq(r.slipNo)));
  }

  let updated = 0;
  for (const row of missing) {
    const ymd = toDateString(row.requestDate)!;
    const next = (dayMax.get(ymd) ?? 0) + 1;
    dayMax.set(ymd, next);
    await prisma.purchaseRequest.update({
      where: { id: row.id },
      data: { slipNo: formatSlipSeq(next) },
    });
    updated += 1;
  }
  return updated;
}

export function serializePurchaseRequest(r: {
  id: string;
  requestDate: Date;
  slipNo: string | null;
  vendorCode: string | null;
  vendorName: string;
  managerCode: string | null;
  managerName: string | null;
  taxType: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  currency: string | null;
  dueDate: Date | null;
  status: string;
  item: string;
  quantity: number;
  amount: number;
  project: string | null;
  attachments?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  lines?: {
    id: string;
    itemCode: string | null;
    itemName: string;
    spec: string | null;
    qty: number;
    unitPrice: number;
    supply: number;
    vat: number;
    total: number;
    extra: string | null;
    sortOrder: number;
  }[];
}) {
  return {
    id: r.id,
    requestDate: toDateString(r.requestDate)!,
    slipNo: r.slipNo ?? undefined,
    vendorCode: r.vendorCode ?? undefined,
    vendor: r.vendorName,
    vendorName: r.vendorName,
    managerCode: r.managerCode ?? undefined,
    managerName: r.managerName ?? undefined,
    manager: r.managerName ?? r.managerCode ?? undefined,
    taxType: r.taxType ?? undefined,
    warehouseCode: r.warehouseCode ?? undefined,
    warehouseName: r.warehouseName ?? undefined,
    warehouse: r.warehouseName ?? r.warehouseCode ?? undefined,
    currency: r.currency ?? undefined,
    dueDate: toDateString(r.dueDate) ?? toDateString(r.requestDate)!,
    status: r.status,
    item: r.item,
    quantity: r.quantity,
    amount: r.amount,
    project: r.project ?? undefined,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
    lines: r.lines?.map((l) => ({
      id: l.id,
      itemCode: l.itemCode ?? "",
      itemName: l.itemName,
      spec: l.spec ?? "",
      qty: l.qty,
      unitPrice: l.unitPrice,
      supply: l.supply,
      vat: l.vat,
      total: l.total,
      extra: l.extra ?? "",
      sortOrder: l.sortOrder,
    })),
  };
}


export function serializeSalesPlan(r: {
  id: string;
  planDate: Date;
  vendorCode: string | null;
  vendorName: string;
  item: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vat: number;
  total: number;
  status: string;
  lastModifier: string | null;
  closed: boolean;
  manager: string | null;
  taxType: string | null;
  warehouse: string | null;
  project: string | null;
  currency: string | null;
  dueDate: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: r.id,
    planDate: toDateString(r.planDate)!,
    vendor: r.vendorName,
    vendorCode: r.vendorCode ?? undefined,
    item: r.item,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    amount: r.amount,
    vat: r.vat,
    total: r.total,
    status: r.status,
    lastModifier: r.lastModifier ?? undefined,
    closed: r.closed,
    manager: r.manager ?? undefined,
    taxType: r.taxType ?? undefined,
    warehouse: r.warehouse ?? undefined,
    project: r.project ?? undefined,
    currency: r.currency ?? undefined,
    dueDate: toDateString(r.dueDate),
    createdAt: r.createdAt?.toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
  };
}

import {
  type EventType,
  type FinanceCategory,
  type MailFolder,
  type PaymentStatus,
  type PurchaseRequestStatus,
  type PurchaseStatus,
  type InboundStatus,
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
import { mockPurchaseRequests } from "@/lib/purchase-requests";
import { mockPurchases } from "@/lib/purchases";

export async function wipeAndSeedDemoWorkspace() {
  await prisma.workspace.upsert({
    where: { id: DEMO_WORKSPACE_ID },
    update: { name: DEMO_WORKSPACE_NAME },
    create: { id: DEMO_WORKSPACE_ID, name: DEMO_WORKSPACE_NAME },
  });

  await prisma.$transaction([
    prisma.purchaseRequestLine.deleteMany({
      where: { request: { workspaceId: DEMO_WORKSPACE_ID } },
    }),
    prisma.purchaseRequest.deleteMany({ where: { workspaceId: DEMO_WORKSPACE_ID } }),
    prisma.purchaseLine.deleteMany({
      where: { purchase: { workspaceId: DEMO_WORKSPACE_ID } },
    }),
    prisma.purchase.deleteMany({ where: { workspaceId: DEMO_WORKSPACE_ID } }),
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


  // Minimal purchase-request seed (header + one line each)
  for (const pr of mockPurchaseRequests.slice(0, 5)) {
    await prisma.purchaseRequest.create({
      data: {
        id: pr.id,
        workspaceId: DEMO_WORKSPACE_ID,
        requestDate: parseDateOnly(pr.requestDate)!,
        vendorName: pr.vendor,
        dueDate: parseDateOnly(pr.dueDate),
        status: pr.status as PurchaseRequestStatus,
        item: pr.item,
        quantity: pr.quantity,
        amount: pr.amount,
        taxType: "과세",
        currency: "내자",
        lines: {
          create: [
            {
              itemName: pr.item,
              qty: pr.quantity,
              unitPrice: pr.quantity ? pr.amount / pr.quantity : 0,
              supply: Math.round(pr.amount / 1.1),
              vat: pr.amount - Math.round(pr.amount / 1.1),
              total: pr.amount,
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }


  // Minimal purchase seed (header + one line) — stable ids for inventory QA
  for (const pu of mockPurchases.slice(0, 8)) {
    await prisma.purchase.create({
      data: {
        id: pu.id,
        workspaceId: DEMO_WORKSPACE_ID,
        purchaseDate: parseDateOnly(pu.purchaseDate)!,
        slipNo: pu.id.replace(/^pu-/i, "") || undefined,
        orderNo: pu.orderNo ?? null,
        vendorCode: pu.vendorCode ?? null,
        vendorName: pu.vendor,
        manager: pu.manager ?? null,
        taxType: pu.taxType ?? "과세",
        warehouseName: pu.warehouse ?? null,
        warehouseCode: pu.warehouseCode ?? null,
        currency: pu.currency ?? "내자",
        project: pu.project ?? null,
        status: pu.status as PurchaseStatus,
        inboundStatus: (pu.inboundStatus ?? "none") as InboundStatus,
        item: pu.item,
        itemCode: pu.itemCode ?? null,
        quantity: pu.quantity,
        amount: pu.amount,
        remarks: pu.remarks ?? null,
        sent: Boolean(pu.sent),
        accountingReflect: Boolean(pu.accountingReflect),
        printed: Boolean(pu.printed),
        importedSlip: pu.importedSlip ?? null,
        lines: {
          create: [
            {
              itemCode: pu.itemCode ?? null,
              itemName: pu.item,
              qty: pu.quantity,
              unitPrice: pu.quantity ? pu.amount / pu.quantity : 0,
              supply: Math.round(pu.amount / 1.1),
              vat: pu.amount - Math.round(pu.amount / 1.1),
              total: pu.amount,
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }

  const counts = {
    tasks: initialTasks.length,
    events: initialEvents.length,
    finances: initialFinances.length,
    mails: initialMails.length,
    purchaseRequests: Math.min(5, mockPurchaseRequests.length),
    purchases: Math.min(8, mockPurchases.length),
  };

  return { workspaceId: DEMO_WORKSPACE_ID, ...counts };
}


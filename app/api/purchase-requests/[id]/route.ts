import { NextResponse } from "next/server";
import type { PurchaseRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  allocateNextSlipNo,
  parseDateOnly,
  serializePurchaseRequest,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type LineInput = {
  itemCode?: string | null;
  itemName?: string | null;
  spec?: string | null;
  qty?: number | string | null;
  unitPrice?: number | string | null;
  supply?: number | string | null;
  vat?: number | string | null;
  total?: number | string | null;
  extra?: string | null;
  sortOrder?: number | null;
};

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapLines(lines: LineInput[] | undefined) {
  if (!Array.isArray(lines)) return null;
  return lines
    .map((l, i) => ({
      itemCode: l.itemCode ? String(l.itemCode) : null,
      itemName: String(l.itemName ?? "").trim() || "(미지정)",
      spec: l.spec ? String(l.spec) : null,
      qty: num(l.qty),
      unitPrice: num(l.unitPrice),
      supply: num(l.supply),
      vat: num(l.vat),
      total: num(l.total),
      extra: l.extra ? String(l.extra) : null,
      sortOrder: typeof l.sortOrder === "number" ? l.sortOrder : i,
    }))
    .filter(
      (l) =>
        l.itemName !== "(미지정)" ||
        (l.itemCode && l.itemCode.trim()) ||
        l.qty > 0
    );
}


type AttachmentInput = {
  id?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | string | null;
  dataUrl?: string | null;
  url?: string | null;
  createdAt?: string | null;
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function mapAttachments(raw: unknown): {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  createdAt: string;
}[] {
  if (!Array.isArray(raw)) return [];
  const out: {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    dataUrl: string;
    createdAt: string;
  }[] = [];
  for (const item of raw as AttachmentInput[]) {
    const fileName = String(item?.fileName ?? "").trim();
    const dataUrl = String(item?.dataUrl ?? item?.url ?? "").trim();
    if (!fileName || !dataUrl) continue;
    const size = num(item?.size);
    if (size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`첨부파일 "${fileName}"이(가) 5MB를 초과합니다.`);
    }
    // Rough base64 payload check (~4/3 of binary size)
    const comma = dataUrl.indexOf(",");
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const approxBytes = Math.floor((b64.length * 3) / 4);
    if (approxBytes > MAX_ATTACHMENT_BYTES + 1024) {
      throw new Error(`첨부파일 "${fileName}"이(가) 5MB를 초과합니다.`);
    }
    out.push({
      id: item?.id ? String(item.id) : `att-${Date.now()}-${out.length}`,
      fileName,
      mimeType: String(item?.mimeType ?? "application/octet-stream"),
      size: size || approxBytes,
      dataUrl,
      createdAt: item?.createdAt
        ? String(item.createdAt)
        : new Date().toISOString(),
    });
  }
  return out;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const row = await prisma.purchaseRequest.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializePurchaseRequest(row));
  } catch (e) {
    console.error("GET /api/purchase-requests/[id]", e);
    return NextResponse.json(
      { error: "Failed to load purchase request" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.purchaseRequest.findFirst({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const lineRows = mapLines(body.lines as LineInput[] | undefined);

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.attachments !== undefined) {
      data.attachments = mapAttachments(body.attachments);
    }
    if (body.requestDate !== undefined)
      data.requestDate = parseDateOnly(body.requestDate) ?? existing.requestDate;
    if (body.slipNo !== undefined)
      data.slipNo = body.slipNo ? String(body.slipNo) : null;

    // Keep human-readable daily No. even if form omitted it (No. field removed from UI)
    const nextRequestDate =
      (data.requestDate as Date | undefined) ?? existing.requestDate;
    const nextSlip =
      data.slipNo !== undefined
        ? (data.slipNo as string | null)
        : existing.slipNo;
    if (!nextSlip) {
      data.slipNo = await allocateNextSlipNo(DEMO_WORKSPACE_ID, nextRequestDate);
    }
    if (body.vendorCode !== undefined)
      data.vendorCode = body.vendorCode ? String(body.vendorCode) : null;
    if (body.vendorName !== undefined || body.vendor !== undefined)
      data.vendorName =
        String(body.vendorName ?? body.vendor ?? "").trim() || "(미지정)";
    if (body.managerCode !== undefined)
      data.managerCode = body.managerCode ? String(body.managerCode) : null;
    if (body.managerName !== undefined || body.manager !== undefined)
      data.managerName =
        body.managerName || body.manager
          ? String(body.managerName ?? body.manager)
          : null;
    if (body.taxType !== undefined)
      data.taxType = body.taxType ? String(body.taxType) : null;
    if (body.warehouseCode !== undefined)
      data.warehouseCode = body.warehouseCode ? String(body.warehouseCode) : null;
    if (body.warehouseName !== undefined || body.warehouse !== undefined)
      data.warehouseName =
        body.warehouseName || body.warehouse
          ? String(body.warehouseName ?? body.warehouse)
          : null;
    if (body.currency !== undefined)
      data.currency = body.currency ? String(body.currency) : null;
    if (body.dueDate !== undefined) data.dueDate = parseDateOnly(body.dueDate);
    if (body.status !== undefined)
      data.status = body.status as PurchaseRequestStatus;
    if (body.item !== undefined) data.item = String(body.item);
    if (body.quantity !== undefined) data.quantity = num(body.quantity);
    if (body.amount !== undefined) data.amount = num(body.amount);
    if (body.project !== undefined)
      data.project = body.project ? String(body.project) : null;

    if (lineRows) {
      if (body.item === undefined) {
        data.item =
          lineRows.length === 0
            ? "(미지정)"
            : lineRows.length === 1
              ? lineRows[0].itemName
              : `${lineRows[0].itemName} 외 ${lineRows.length - 1}건`;
      }
      if (body.quantity === undefined)
        data.quantity = lineRows.reduce((s, l) => s + l.qty, 0);
      if (body.amount === undefined)
        data.amount = lineRows.reduce((s, l) => s + (l.total || l.supply), 0);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (lineRows) {
        await tx.purchaseRequestLine.deleteMany({ where: { requestId: id } });
        if (lineRows.length) {
          await tx.purchaseRequestLine.createMany({
            data: lineRows.map((l) => ({ ...l, requestId: id })),
          });
        }
      }
      await tx.purchaseRequest.update({
        where: { id },
        data,
      });
      return tx.purchaseRequest.findUniqueOrThrow({
        where: { id },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return NextResponse.json(serializePurchaseRequest(updated));
  } catch (e) {
    console.error("PATCH /api/purchase-requests/[id]", e);
    const msg = e instanceof Error ? e.message : "Failed to update purchase request";
    const status = msg.includes("5MB") ? 400 : 500;
    return NextResponse.json(
      { error: msg },
      { status }
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await prisma.purchaseRequest.deleteMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/purchase-requests/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete purchase request" },
      { status: 500 }
    );
  }
}

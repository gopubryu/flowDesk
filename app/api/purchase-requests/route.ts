import { NextResponse } from "next/server";
import type { PurchaseRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bodyWorkspaceId, authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import {
  allocateNextSlipNo,
  backfillMissingPurchaseRequestSlipNos,
  parseDateOnly,
  serializePurchaseRequest,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

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
  if (!Array.isArray(lines)) return [];
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

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    await backfillMissingPurchaseRequestSlipNos(workspaceId);
    const rows = await prisma.purchaseRequest.findMany({
      where: { workspaceId: workspaceId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ requestDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(rows.map(serializePurchaseRequest));
  } catch (e) {
    return authError(e) ?? NextResponse.json(
      { error: "Failed to load purchase requests" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const lineRows = mapLines(body.lines as LineInput[] | undefined);
    const attachments =
      body.attachments !== undefined
        ? mapAttachments(body.attachments)
        : [];

    const vendorName =
      String(body.vendorName ?? body.vendor ?? "").trim() || "(미지정)";
    const item =
      String(body.item ?? "").trim() ||
      (lineRows.length === 0
        ? "(미지정)"
        : lineRows.length === 1
          ? lineRows[0].itemName
          : `${lineRows[0].itemName} 외 ${lineRows.length - 1}건`);

    const quantity =
      body.quantity !== undefined
        ? num(body.quantity)
        : lineRows.reduce((s, l) => s + l.qty, 0);
    const amount =
      body.amount !== undefined
        ? num(body.amount)
        : lineRows.reduce((s, l) => s + (l.total || l.supply), 0);

    const requestDate = parseDateOnly(body.requestDate) ?? new Date();
    const slipNo = body.slipNo
      ? String(body.slipNo)
      : await allocateNextSlipNo(workspaceId, requestDate);

    const created = await prisma.purchaseRequest.create({
      data: {
        workspaceId: workspaceId,
        requestDate,
        slipNo,
        vendorCode: body.vendorCode ? String(body.vendorCode) : null,
        vendorName,
        managerCode: body.managerCode ? String(body.managerCode) : null,
        managerName:
          body.managerName || body.manager
            ? String(body.managerName ?? body.manager)
            : null,
        taxType: body.taxType ? String(body.taxType) : null,
        warehouseCode: body.warehouseCode ? String(body.warehouseCode) : null,
        warehouseName:
          body.warehouseName || body.warehouse
            ? String(body.warehouseName ?? body.warehouse)
            : null,
        currency: body.currency ? String(body.currency) : null,
        dueDate: parseDateOnly(body.dueDate),
        status: (body.status as PurchaseRequestStatus) ?? "unconfirmed",
        item,
        quantity,
        amount,
        project: body.project ? String(body.project) : null,
        attachments,
        lines: lineRows.length
          ? { create: lineRows }
          : undefined,
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(serializePurchaseRequest(created), { status: 201 });
  } catch (e) {
    const auth = authError(e);
    if (auth) return auth;
    const msg = e instanceof Error ? e.message : "Failed to create purchase request";
    const status = msg.includes("5MB") ? 400 : 500;
    return NextResponse.json(
      { error: msg },
      { status }
    );
  }
}

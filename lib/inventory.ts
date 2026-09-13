/** Client types & helpers for FlowDesk 재고 v1 */

export type StockMovementType = "receipt" | "shipment" | "adjustment";

export type InboundStatus = "none" | "partial" | "complete";
export type OutboundStatus = "none" | "partial" | "complete";

export const INBOUND_STATUS_LABEL: Record<InboundStatus, string> = {
  none: "미입고",
  partial: "부분입고",
  complete: "입고완료",
};

export const OUTBOUND_STATUS_LABEL: Record<OutboundStatus, string> = {
  none: "미출하",
  partial: "부분출하",
  complete: "출하완료",
};

export const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  receipt: "입고",
  shipment: "출하",
  adjustment: "조정",
};

export interface StockBalanceRow {
  id: string;
  warehouseCode: string;
  warehouseName?: string;
  itemCode: string;
  itemName?: string;
  qty: number;
  updatedAt?: string;
}

export interface StockMovementRow {
  id: string;
  date: string;
  type: StockMovementType;
  slipNo: string;
  warehouseCode: string;
  warehouseName?: string;
  itemCode: string;
  itemName?: string;
  itemSpec?: string;
  itemUnit?: string;
  qty: number;
  relatedType?: string;
  relatedId?: string;
  memo?: string;
  manager?: string;
  vendorCode?: string;
  vendorName?: string;
  createdAt?: string;
}

export interface InventorySlipLineInput {
  itemCode: string;
  itemName?: string;
  itemSpec?: string;
  itemUnit?: string;
  qty: number;
  memo?: string;
}

export interface ReceiptInput {
  date: string;
  slipNo?: string;
  warehouseCode: string;
  warehouseName?: string;
  manager?: string;
  memo?: string;
  relatedType?: string;
  relatedId?: string;
  vendorCode?: string;
  vendorName?: string;
  lines: InventorySlipLineInput[];
}

export interface ShipmentInput {
  date: string;
  slipNo?: string;
  warehouseCode: string;
  warehouseName?: string;
  manager?: string;
  memo?: string;
  relatedType?: string;
  relatedId?: string;
  vendorCode?: string;
  vendorName?: string;
  lines: InventorySlipLineInput[];
}

export interface AdjustmentInput {
  date: string;
  warehouseCode: string;
  warehouseName?: string;
  itemCode: string;
  itemName?: string;
  bookQty: number;
  actualQty: number;
  reason: string;
  manager?: string;
}

export interface InventoryStatusSummary {
  pendingInbound: { relatedId: string; vendorName?: string; itemLabel: string; remainQty: number }[];
  pendingOutbound: { relatedId: string; vendorName?: string; itemLabel: string; remainQty: number }[];
  belowMinStock: { warehouseCode: string; warehouseName?: string; itemCode: string; itemName?: string; qty: number; minStock: number }[];
  balances?: { warehouseCode: string; warehouseName?: string; itemCode: string; itemName?: string; qty: number }[];
  todayIn: number;
  todayOut: number;
}

export function computeInboundStatus(purchaseQty: number, receivedQty: number): InboundStatus {
  if (receivedQty <= 0) return "none";
  if (receivedQty + 1e-9 >= purchaseQty) return "complete";
  return "partial";
}

export function computeOutboundStatus(planQty: number, shippedQty: number): OutboundStatus {
  if (shippedQty <= 0) return "none";
  if (shippedQty + 1e-9 >= planQty) return "complete";
  return "partial";
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = String(body.error);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchBalances(params?: {
  warehouseCode?: string;
  itemCode?: string;
  itemCodes?: string[];
}): Promise<StockBalanceRow[]> {
  const q = new URLSearchParams();
  if (params?.warehouseCode) q.set("warehouseCode", params.warehouseCode);
  if (params?.itemCode) q.set("itemCode", params.itemCode);
  if (params?.itemCodes?.length) q.set("itemCodes", params.itemCodes.join(","));
  const qs = q.toString();
  return apiJson(`/api/inventory/balances${qs ? `?${qs}` : ""}`);
}

export async function fetchMovements(params?: {
  dateFrom?: string;
  dateTo?: string;
  warehouseCode?: string;
  itemCode?: string;
  type?: string;
  relatedType?: string;
  relatedId?: string;
  slipNo?: string;
}): Promise<StockMovementRow[]> {
  const q = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v);
    }
  }
  const qs = q.toString();
  return apiJson(`/api/inventory/movements${qs ? `?${qs}` : ""}`);
}

export async function fetchNextSlipNo(
  type: "receipt" | "shipment",
  date: string
): Promise<string> {
  const q = new URLSearchParams({ type, date });
  const res = await apiJson<{ slipNo: string }>(`/api/inventory/next-slip?${q}`);
  return res.slipNo;
}

export async function createReceipt(input: ReceiptInput): Promise<{
  slipNo: string;
  movements: StockMovementRow[];
  relatedReceivedQty: number;
}> {
  return apiJson("/api/inventory/receipts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createShipment(input: ShipmentInput): Promise<{
  slipNo: string;
  movements: StockMovementRow[];
  relatedShippedQty: number;
  outboundStatus?: OutboundStatus;
}> {
  return apiJson("/api/inventory/shipments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createAdjustment(input: AdjustmentInput): Promise<{
  slipNo: string;
  movement: StockMovementRow;
}> {
  return apiJson("/api/inventory/adjustments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchReceiptSlips(): Promise<
  {
    slipNo: string;
    date: string;
    warehouseCode: string;
    warehouseName?: string;
    vendorName?: string;
    manager?: string;
    memo?: string;
    relatedId?: string;
    totalQty: number;
    lineCount: number;
  }[]
> {
  return apiJson("/api/inventory/receipts");
}


export async function fetchShipmentSlips(): Promise<
  {
    slipNo: string;
    date: string;
    warehouseCode: string;
    warehouseName?: string;
    vendorName?: string;
    manager?: string;
    memo?: string;
    relatedId?: string;
    totalQty: number;
    lineCount: number;
  }[]
> {
  return apiJson("/api/inventory/shipments");
}

export async function fetchAdjustmentSlips(): Promise<
  {
    slipNo: string;
    date: string;
    warehouseCode: string;
    warehouseName?: string;
    vendorName?: string;
    manager?: string;
    memo?: string;
    relatedId?: string;
    totalQty: number;
    lineCount: number;
  }[]
> {
  return apiJson("/api/inventory/adjustments");
}

export async function fetchRelatedQty(params: {
  relatedType: string;
  relatedIds: string[];
}): Promise<Record<string, number>> {
  if (!params.relatedIds.length) return {};
  const q = new URLSearchParams({
    relatedType: params.relatedType,
    relatedIds: params.relatedIds.join(","),
  });
  return apiJson(`/api/inventory/related-qty?${q}`);
}

export async function fetchInventoryStatus(): Promise<InventoryStatusSummary> {
  return apiJson("/api/inventory/status");
}

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

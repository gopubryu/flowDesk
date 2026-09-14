import { activeWorkspaceId } from "./master-data-client";
export type PurchaseRequestStatus =
  | "approval"
  | "unconfirmed"
  | "confirmed"
  | "in_progress"
  | "completed";

export interface PurchaseRequestAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  createdAt: string;
}

export interface PurchaseRequestLine {
  id?: string;
  itemCode?: string;
  itemName: string;
  spec?: string;
  qty: number;
  unitPrice?: number;
  supply?: number;
  vat?: number;
  total?: number;
  extra?: string;
  sortOrder?: number;
}

export interface PurchaseRequest {
  id: string;
  requestDate: string;
  vendor: string;
  item: string;
  dueDate: string;
  quantity: number;
  amount: number;
  status: PurchaseRequestStatus;
  /** optional master fields from 발주요청입력 */
  manager?: string;
  taxType?: string;
  warehouse?: string;
  project?: string;
  currency?: string;
  slipNo?: string;
  vendorCode?: string;
  vendorName?: string;
  managerCode?: string;
  managerName?: string;
  warehouseCode?: string;
  warehouseName?: string;
  lines?: PurchaseRequestLine[];
  attachments?: PurchaseRequestAttachment[];
  createdAt?: string;
  updatedAt?: string;
}

export const PURCHASE_REQUEST_STATUS_TABS: {
  key: "all" | PurchaseRequestStatus;
  label: string;
}[] = [
  { key: "all", label: "전체" },
  { key: "approval", label: "결재중" },
  { key: "unconfirmed", label: "미확인" },
  { key: "confirmed", label: "확인" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "완료" },
];

export const PURCHASE_REQUEST_STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  approval: "결재중",
  unconfirmed: "미확인",
  confirmed: "확인",
  in_progress: "진행중",
  completed: "완료",
};

export const TAX_TYPE_OPTIONS = [
  "과세",
  "영세",
  "면세",
] as const;

export const CURRENCY_OPTIONS = [
  "내자",
  "달러[100]",
  "엔화[400]",
  "위안",
  "유로",
] as const;

/** UI label without unit brackets, e.g. 달러[100] → 달러 */
export function formatCurrencyLabel(value: string): string {
  return String(value ?? "").replace(/\[[^\]]*\]/g, "").trim() || value;
}


/** Human-readable 일자-No. label (never exposes cuid). */
export function formatPurchaseRequestDateNo(
  requestDate: string,
  slipNo?: string | null
): string {
  const date = (requestDate || "").trim();
  const no = (slipNo || "").trim();
  if (date && no) return `${date}-${no}`;
  if (date) return date;
  if (no) return no;
  return "—";
}

const STORAGE_KEY = "flowdesk-purchase-requests";

/** Seed samples used when DB is empty / optional seed */
export const mockPurchaseRequests: PurchaseRequest[] = [
  {
    id: "pr-001",
    requestDate: "2026-08-28",
    vendor: "한빛산업",
    item: "스테인리스 볼트 M8",
    dueDate: "2026-09-10",
    quantity: 2000,
    amount: 840000,
    status: "in_progress",
  },
  {
    id: "pr-002",
    requestDate: "2026-08-29",
    vendor: "세진전자",
    item: "전원 어댑터 12V 5A",
    dueDate: "2026-09-05",
    quantity: 150,
    amount: 2250000,
    status: "approval",
  },
  {
    id: "pr-003",
    requestDate: "2026-08-30",
    vendor: "동아포장",
    item: "골판지 박스 중형",
    dueDate: "2026-09-08",
    quantity: 500,
    amount: 650000,
    status: "unconfirmed",
  },
  {
    id: "pr-004",
    requestDate: "2026-09-01",
    vendor: "미래케미칼",
    item: "산업용 세척제 20L",
    dueDate: "2026-09-12",
    quantity: 40,
    amount: 1280000,
    status: "confirmed",
  },
  {
    id: "pr-005",
    requestDate: "2026-09-01",
    vendor: "코리아베어링",
    item: "베어링 6204-2RS",
    dueDate: "2026-09-15",
    quantity: 300,
    amount: 960000,
    status: "completed",
  },
  {
    id: "pr-006",
    requestDate: "2026-09-02",
    vendor: "푸른물산",
    item: "PVC 파이프 50A",
    dueDate: "2026-09-18",
    quantity: 120,
    amount: 540000,
    status: "in_progress",
  },
  {
    id: "pr-007",
    requestDate: "2026-09-02",
    vendor: "스마트오피스",
    item: "A4 복사용지 80g",
    dueDate: "2026-09-07",
    quantity: 50,
    amount: 175000,
    status: "unconfirmed",
  },
  {
    id: "pr-008",
    requestDate: "2026-09-03",
    vendor: "남해철강",
    item: "각파이프 40x40",
    dueDate: "2026-09-20",
    quantity: 80,
    amount: 1920000,
    status: "approval",
  },
  {
    id: "pr-009",
    requestDate: "2026-09-03",
    vendor: "이노텍솔루션",
    item: "PLC 릴레이 모듈",
    dueDate: "2026-09-14",
    quantity: 25,
    amount: 3125000,
    status: "confirmed",
  },
  {
    id: "pr-010",
    requestDate: "2026-09-04",
    vendor: "한빛산업",
    item: "육각너트 M10",
    dueDate: "2026-09-16",
    quantity: 5000,
    amount: 450000,
    status: "completed",
  },
  {
    id: "pr-011",
    requestDate: "2026-09-05",
    vendor: "그린로지스",
    item: "팔레트 랩 필름",
    dueDate: "2026-09-11",
    quantity: 60,
    amount: 780000,
    status: "in_progress",
  },
  {
    id: "pr-012",
    requestDate: "2026-09-05",
    vendor: "세진전자",
    item: "USB-C 허브 7포트",
    dueDate: "2026-09-22",
    quantity: 30,
    amount: 1350000,
    status: "approval",
  },
];

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Fetch all purchase requests from Neon/Prisma API */
export async function fetchPurchaseRequests(): Promise<PurchaseRequest[]> {
  const workspaceId = await activeWorkspaceId();
  return apiJson<PurchaseRequest[]>(`/api/purchase-requests?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function fetchPurchaseRequest(
  id: string
): Promise<PurchaseRequest> {
  const workspaceId = await activeWorkspaceId();
  return apiJson<PurchaseRequest>(`/api/purchase-requests/${id}?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export type PurchaseRequestInput = Omit<PurchaseRequest, "id"> & {
  id?: string;
  lines?: PurchaseRequestLine[];
  attachments?: PurchaseRequestAttachment[];
};

/** Create (POST) or update (PATCH) a purchase request via API */
export async function savePurchaseRequestApi(
  row: PurchaseRequestInput
): Promise<PurchaseRequest> {
  const workspaceId = await activeWorkspaceId();
  const payload = {
    workspaceId,
    requestDate: row.requestDate,
    slipNo: row.slipNo,
    vendorCode: row.vendorCode,
    vendorName: row.vendorName ?? row.vendor,
    vendor: row.vendor,
    managerCode: row.managerCode,
    managerName: row.managerName ?? row.manager,
    manager: row.manager,
    taxType: row.taxType,
    warehouseCode: row.warehouseCode,
    warehouseName: row.warehouseName ?? row.warehouse,
    warehouse: row.warehouse,
    currency: row.currency,
    dueDate: row.dueDate,
    status: row.status,
    item: row.item,
    quantity: row.quantity,
    amount: row.amount,
    project: row.project,
    lines: row.lines,
    attachments: row.attachments,
  };
  if (row.id) {
    return apiJson<PurchaseRequest>(`/api/purchase-requests/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }
  return apiJson<PurchaseRequest>("/api/purchase-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deletePurchaseRequestApi(id: string): Promise<void> {
  const workspaceId = await activeWorkspaceId();
  await apiJson(`/api/purchase-requests/${id}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
}

/** PATCH only status for selected rows on list */
export async function updatePurchaseRequestStatusApi(
  id: string,
  status: PurchaseRequestStatus
): Promise<PurchaseRequest> {
  const workspaceId = await activeWorkspaceId();
  return apiJson<PurchaseRequest>(`/api/purchase-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, workspaceId }),
  });
}

/** @deprecated Prefer fetchPurchaseRequests — kept for offline fallback */
export function loadPurchaseRequests(): PurchaseRequest[] {
  if (typeof window === "undefined") return mockPurchaseRequests;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...mockPurchaseRequests];
    const parsed = JSON.parse(raw) as PurchaseRequest[];
    return Array.isArray(parsed) ? parsed : [...mockPurchaseRequests];
  } catch {
    return [...mockPurchaseRequests];
  }
}

/** @deprecated Prefer savePurchaseRequestApi */
export function savePurchaseRequests(rows: PurchaseRequest[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

/** @deprecated Prefer savePurchaseRequestApi */
export function appendPurchaseRequest(row: PurchaseRequest): PurchaseRequest[] {
  const next = [row, ...loadPurchaseRequests()];
  savePurchaseRequests(next);
  return next;
}

/** @deprecated IDs are now cuid from Prisma */
export function nextPurchaseRequestId(): string {
  const rows = loadPurchaseRequests();
  let max = 0;
  for (const r of rows) {
    const m = /^pr-(\d+)$/i.exec(r.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `pr-${String(max + 1).padStart(3, "0")}`;
}

export interface PurchaseRequestStatusAggRow {
  key: string;
  vendor: string;
  item: string;
  requestCount: number;
  quantitySum: number;
  amountSum: number;
  status: PurchaseRequestStatus;
}

export interface PurchaseRequestStatusSummary {
  count: number;
  quantitySum: number;
  amountSum: number;
  inProgressCount: number;
}

export function summarizePurchaseRequests(
  rows: PurchaseRequest[]
): PurchaseRequestStatusSummary {
  let quantitySum = 0;
  let amountSum = 0;
  let inProgressCount = 0;
  for (const r of rows) {
    quantitySum += r.quantity;
    amountSum += r.amount;
    if (r.status === "in_progress") inProgressCount += 1;
  }
  return {
    count: rows.length,
    quantitySum,
    amountSum,
    inProgressCount,
  };
}

/** Aggregate by vendor + item + status for 발주요청현황 */
export function aggregatePurchaseRequestsByVendorStatus(
  rows: PurchaseRequest[]
): PurchaseRequestStatusAggRow[] {
  const map = new Map<string, PurchaseRequestStatusAggRow>();
  for (const r of rows) {
    const key = `${r.vendor}\0${r.item}\0${r.status}`;
    const existing = map.get(key);
    if (existing) {
      existing.requestCount += 1;
      existing.quantitySum += r.quantity;
      existing.amountSum += r.amount;
    } else {
      map.set(key, {
        key,
        vendor: r.vendor,
        item: r.item,
        requestCount: 1,
        quantitySum: r.quantity,
        amountSum: r.amount,
        status: r.status,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const v = a.vendor.localeCompare(b.vendor, "ko");
    if (v !== 0) return v;
    const i = a.item.localeCompare(b.item, "ko");
    if (i !== 0) return i;
    return a.status.localeCompare(b.status);
  });
}

export function countByPurchaseRequestStatus(
  rows: PurchaseRequest[]
): { status: PurchaseRequestStatus | "all"; label: string; count: number }[] {
  const counts: Record<PurchaseRequestStatus, number> = {
    approval: 0,
    unconfirmed: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
  };
  for (const r of rows) counts[r.status] += 1;
  return PURCHASE_REQUEST_STATUS_TABS.map((t) => ({
    status: t.key,
    label: t.label,
    count: t.key === "all" ? rows.length : counts[t.key],
  }));
}

/** Default ~2 month range ending today (local) */
export function defaultPurchaseRequestDateRange(today = new Date()): {
  from: string;
  to: string;
} {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const from = new Date(to);
  from.setMonth(from.getMonth() - 2);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { from: fmt(from), to: fmt(to) };
}

export type SalesPlanStatus =
  | "confirmed"
  | "in_progress"
  | "completed";

export interface SalesPlanLine {
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

export interface SalesPlan {
  id: string;
  /** 판매계획일자 */
  planDate: string;
  /** Daily sequential slip no (0001…) — used for human-readable 일자-No. */
  slipNo?: string;
  vendor: string;
  vendorCode?: string;
  item: string;
  itemCode?: string;
  spec?: string;
  quantity: number;
  unitPrice: number;
  /** 공급가액(금액) */
  amount: number;
  vat: number;
  /** 합계 = amount + vat */
  total: number;
  status: SalesPlanStatus;
  /** 최종수정자 */
  lastModifier?: string;
  /** 종결여부 */
  closed?: boolean;
  manager?: string;
  taxType?: string;
  warehouse?: string;
  project?: string;
  currency?: string;
  dueDate?: string;
  lines?: SalesPlanLine[];
}

export const SALES_PLAN_STATUS_TABS: {
  key: "all" | SalesPlanStatus;
  label: string;
}[] = [
  { key: "all", label: "전체" },
  { key: "confirmed", label: "확인" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "완료" },
];

export const SALES_PLAN_STATUS_LABEL: Record<SalesPlanStatus, string> = {
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
export function formatSalesPlanDateNo(
  planDate: string,
  slipNo?: string | null
): string {
  const date = (planDate || "").trim();
  const no = (slipNo || "").trim();
  if (date && no) return `${date}-${no}`;
  if (date) return date;
  if (no) return no;
  return "—";
}

const STORAGE_KEY = "flowdesk-sales-plans";

/** Local mock rows for 판매계획조회 — not wired to Prisma/Neon */
export const mockSalesPlans: SalesPlan[] = [
  {
    id: "sp-001",
    planDate: "2026-08-28",
    vendor: "한빛산업",
    vendorCode: "V001",
    item: "스테인리스 볼트 M8",
    quantity: 2000,
    unitPrice: 420,
    amount: 840000,
    vat: 84000,
    total: 924000,
    status: "in_progress",
    lastModifier: "김구매",
    closed: false,
    manager: "김구매",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    dueDate: "2026-09-10",
  },
  {
    id: "sp-002",
    planDate: "2026-08-29",
    vendor: "세진전자",
    vendorCode: "V002",
    item: "전원 어댑터 12V 5A",
    quantity: 150,
    unitPrice: 15000,
    amount: 2250000,
    vat: 225000,
    total: 2475000,
    status: "confirmed",
    lastModifier: "이입고",
    closed: false,
    manager: "이입고",
    taxType: "과세",
    warehouse: "전자부품창고",
    currency: "내자",
    dueDate: "2026-09-05",
  },
  {
    id: "sp-003",
    planDate: "2026-08-30",
    vendor: "동아포장",
    vendorCode: "V003",
    item: "골판지 박스 중형",
    quantity: 500,
    unitPrice: 1300,
    amount: 650000,
    vat: 65000,
    total: 715000,
    status: "in_progress",
    lastModifier: "김구매",
    closed: false,
    manager: "김구매",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    dueDate: "2026-09-08",
  },
  {
    id: "sp-004",
    planDate: "2026-09-01",
    vendor: "미래케미칼",
    vendorCode: "V004",
    item: "산업용 세척제 20L",
    quantity: 40,
    unitPrice: 32000,
    amount: 1280000,
    vat: 128000,
    total: 1408000,
    status: "confirmed",
    lastModifier: "박자재",
    closed: false,
    manager: "박자재",
    taxType: "과세",
    warehouse: "화공창고",
    currency: "내자",
    dueDate: "2026-09-12",
  },
  {
    id: "sp-005",
    planDate: "2026-09-01",
    vendor: "코리아베어링",
    vendorCode: "V005",
    item: "베어링 6204-2RS",
    quantity: 300,
    unitPrice: 3200,
    amount: 960000,
    vat: 96000,
    total: 1056000,
    status: "completed",
    lastModifier: "이입고",
    closed: true,
    manager: "이입고",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    dueDate: "2026-09-15",
  },
  {
    id: "sp-006",
    planDate: "2026-09-02",
    vendor: "푸른물산",
    vendorCode: "V006",
    item: "PVC 파이프 50A",
    quantity: 120,
    unitPrice: 4500,
    amount: 540000,
    vat: 54000,
    total: 594000,
    status: "in_progress",
    lastModifier: "김구매",
    closed: false,
    manager: "김구매",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    dueDate: "2026-09-18",
  },
  {
    id: "sp-007",
    planDate: "2026-09-02",
    vendor: "스마트오피스",
    vendorCode: "V007",
    item: "A4 복사용지 80g",
    quantity: 50,
    unitPrice: 3500,
    amount: 175000,
    vat: 17500,
    total: 192500,
    status: "confirmed",
    lastModifier: "박자재",
    closed: false,
    manager: "박자재",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    dueDate: "2026-09-07",
  },
  {
    id: "sp-008",
    planDate: "2026-09-03",
    vendor: "남해철강",
    vendorCode: "V008",
    item: "각파이프 40x40",
    quantity: 80,
    unitPrice: 24000,
    amount: 1920000,
    vat: 192000,
    total: 2112000,
    status: "in_progress",
    lastModifier: "이입고",
    closed: false,
    manager: "이입고",
    taxType: "과세",
    warehouse: "철강야적",
    currency: "내자",
    dueDate: "2026-09-20",
  },
  {
    id: "sp-009",
    planDate: "2026-09-03",
    vendor: "이노텍솔루션",
    vendorCode: "V009",
    item: "PLC 릴레이 모듈",
    quantity: 25,
    unitPrice: 125000,
    amount: 3125000,
    vat: 312500,
    total: 3437500,
    status: "confirmed",
    lastModifier: "김구매",
    closed: false,
    manager: "김구매",
    taxType: "과세",
    warehouse: "전자부품창고",
    currency: "달러[100]",
    dueDate: "2026-09-14",
  },
  {
    id: "sp-010",
    planDate: "2026-09-04",
    vendor: "한빛산업",
    vendorCode: "V001",
    item: "육각너트 M10",
    quantity: 5000,
    unitPrice: 90,
    amount: 450000,
    vat: 45000,
    total: 495000,
    status: "completed",
    lastModifier: "박자재",
    closed: true,
    manager: "박자재",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    dueDate: "2026-09-16",
  },
];

const OLD_STORAGE_KEY = "flowdesk-purchase-plans";

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function fetchSalesPlans(): Promise<SalesPlan[]> {
  return apiJson<SalesPlan[]>("/api/sales-plans");
}

export async function fetchSalesPlan(id: string): Promise<SalesPlan> {
  return apiJson<SalesPlan>(`/api/sales-plans/${id}`);
}

export type SalesPlanInput = Omit<SalesPlan, "id"> & { id?: string };

export async function saveSalesPlanApi(
  input: SalesPlanInput
): Promise<SalesPlan> {
  const { id, ...rest } = input;
  if (id) {
    return apiJson<SalesPlan>(`/api/sales-plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(rest),
    });
  }
  return apiJson<SalesPlan>("/api/sales-plans", {
    method: "POST",
    body: JSON.stringify(rest),
  });
}

export async function deleteSalesPlanApi(id: string): Promise<void> {
  await apiJson(`/api/sales-plans/${id}`, { method: "DELETE" });
}

export async function updateSalesPlanStatusApi(
  id: string,
  status: SalesPlanStatus
): Promise<SalesPlan> {
  return apiJson<SalesPlan>(`/api/sales-plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}


export function loadSalesPlans(): SalesPlan[] {
  if (typeof window === "undefined") return mockSalesPlans;
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(OLD_STORAGE_KEY);
      if (legacy) {
        window.localStorage.setItem(STORAGE_KEY, legacy);
        window.localStorage.removeItem(OLD_STORAGE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return [...mockSalesPlans];
    const parsed = JSON.parse(raw) as SalesPlan[];
    return Array.isArray(parsed) ? parsed : [...mockSalesPlans];
  } catch {
    return [...mockSalesPlans];
  }
}

export function saveSalesPlans(rows: SalesPlan[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function appendSalesPlan(row: SalesPlan): SalesPlan[] {
  const next = [row, ...loadSalesPlans()];
  saveSalesPlans(next);
  return next;
}

export function nextSalesPlanId(): string {
  const rows = loadSalesPlans();
  let max = 0;
  for (const r of rows) {
    const m = /^sp-(\d+)$/i.exec(r.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `sp-${String(max + 1).padStart(3, "0")}`;
}

export interface SalesPlanStatusSummary {
  count: number;
  quantitySum: number;
  amountSum: number;
  totalSum: number;
  inProgressCount: number;
}

export function summarizeSalesPlans(
  rows: SalesPlan[]
): SalesPlanStatusSummary {
  let quantitySum = 0;
  let amountSum = 0;
  let totalSum = 0;
  let inProgressCount = 0;
  for (const r of rows) {
    quantitySum += r.quantity;
    amountSum += r.amount;
    totalSum += r.total;
    if (r.status === "in_progress") inProgressCount += 1;
  }
  return {
    count: rows.length,
    quantitySum,
    amountSum,
    totalSum,
    inProgressCount,
  };
}

export function countBySalesPlanStatus(
  rows: SalesPlan[]
): { status: SalesPlanStatus | "all"; label: string; count: number }[] {
  const counts: Record<SalesPlanStatus, number> = {
    confirmed: 0,
    in_progress: 0,
    completed: 0,
  };
  for (const r of rows) counts[r.status] += 1;
  return SALES_PLAN_STATUS_TABS.map((t) => ({
    status: t.key,
    label: t.label,
    count: t.key === "all" ? rows.length : counts[t.key],
  }));
}

/** Default ~2 month range ending today (local) */
export function defaultSalesPlanDateRange(today = new Date()): {
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

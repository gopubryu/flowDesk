export type PurchaseStatus =
  | "approval"
  | "unconfirmed"
  | "confirmed"
  | "in_progress"
  | "completed";

export interface Purchase {
  id: string;
  /** 구매일자 */
  purchaseDate: string;
  vendor: string;
  item: string;
  /** 납기/입고예정일 */
  dueDate: string;
  /** 입고일 (optional) */
  receiptDate?: string;
  quantity: number;
  amount: number;
  status: PurchaseStatus;
  /** 종결여부 */
  closed?: boolean;
  manager?: string;
  taxType?: string;
  warehouse?: string;
  project?: string;
  /** 내외자/통화 */
  currency?: string;
}

export const PURCHASE_STATUS_TABS: {
  key: "all" | PurchaseStatus;
  label: string;
}[] = [
  { key: "all", label: "전체" },
  { key: "approval", label: "결재중" },
  { key: "unconfirmed", label: "미확인" },
  { key: "confirmed", label: "확인" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "완료" },
];

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  approval: "결재중",
  unconfirmed: "미확인",
  confirmed: "확인",
  in_progress: "진행중",
  completed: "완료",
};

export const TAX_TYPE_OPTIONS = [
  "부가세율 적용",
  "부가세불적용",
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

const STORAGE_KEY = "flowdesk-purchases";

/** Local mock rows for 구매조회 — not wired to Prisma/Neon */
export const mockPurchases: Purchase[] = [
  {
    id: "pu-001",
    purchaseDate: "2026-08-28",
    vendor: "한빛산업",
    item: "스테인리스 볼트 M8",
    dueDate: "2026-09-10",
    receiptDate: "2026-09-09",
    quantity: 2000,
    amount: 924000,
    status: "in_progress",
    closed: false,
    manager: "김구매",
    taxType: "부가세율 적용",
    warehouse: "본사창고",
    currency: "내자",
  },
  {
    id: "pu-002",
    purchaseDate: "2026-08-29",
    vendor: "세진전자",
    item: "전원 어댑터 12V 5A",
    dueDate: "2026-09-05",
    quantity: 150,
    amount: 2475000,
    status: "approval",
    closed: false,
    manager: "이입고",
    taxType: "부가세율 적용",
    warehouse: "전자부품창고",
    currency: "내자",
  },
  {
    id: "pu-003",
    purchaseDate: "2026-08-30",
    vendor: "동아포장",
    item: "골판지 박스 중형",
    dueDate: "2026-09-08",
    quantity: 500,
    amount: 715000,
    status: "unconfirmed",
    closed: false,
    manager: "김구매",
    taxType: "부가세율 적용",
    warehouse: "본사창고",
    currency: "내자",
  },
  {
    id: "pu-004",
    purchaseDate: "2026-09-01",
    vendor: "미래케미칼",
    item: "산업용 세척제 20L",
    dueDate: "2026-09-12",
    receiptDate: "2026-09-11",
    quantity: 40,
    amount: 1408000,
    status: "confirmed",
    closed: false,
    manager: "박자재",
    taxType: "부가세율 적용",
    warehouse: "화공창고",
    currency: "내자",
  },
  {
    id: "pu-005",
    purchaseDate: "2026-09-01",
    vendor: "코리아베어링",
    item: "베어링 6204-2RS",
    dueDate: "2026-09-15",
    receiptDate: "2026-09-14",
    quantity: 300,
    amount: 1056000,
    status: "completed",
    closed: true,
    manager: "이입고",
    taxType: "부가세율 적용",
    warehouse: "본사창고",
    currency: "내자",
  },
  {
    id: "pu-006",
    purchaseDate: "2026-09-02",
    vendor: "푸른물산",
    item: "PVC 파이프 50A",
    dueDate: "2026-09-18",
    quantity: 120,
    amount: 594000,
    status: "in_progress",
    closed: false,
    manager: "김구매",
    taxType: "부가세율 적용",
    warehouse: "본사창고",
    currency: "내자",
  },
  {
    id: "pu-007",
    purchaseDate: "2026-09-02",
    vendor: "스마트오피스",
    item: "A4 복사용지 80g",
    dueDate: "2026-09-07",
    quantity: 50,
    amount: 192500,
    status: "unconfirmed",
    closed: false,
    manager: "박자재",
    taxType: "부가세율 적용",
    warehouse: "본사창고",
    currency: "내자",
  },
  {
    id: "pu-008",
    purchaseDate: "2026-09-03",
    vendor: "남해철강",
    item: "각파이프 40x40",
    dueDate: "2026-09-20",
    quantity: 80,
    amount: 2112000,
    status: "approval",
    closed: false,
    manager: "이입고",
    taxType: "부가세율 적용",
    warehouse: "철강야적",
    currency: "내자",
  },
  {
    id: "pu-009",
    purchaseDate: "2026-09-03",
    vendor: "이노텍솔루션",
    item: "PLC 릴레이 모듈",
    dueDate: "2026-09-14",
    receiptDate: "2026-09-13",
    quantity: 25,
    amount: 3437500,
    status: "confirmed",
    closed: false,
    manager: "김구매",
    taxType: "부가세율 적용",
    warehouse: "전자부품창고",
    currency: "달러[100]",
  },
  {
    id: "pu-010",
    purchaseDate: "2026-09-04",
    vendor: "한빛산업",
    item: "육각너트 M10",
    dueDate: "2026-09-16",
    receiptDate: "2026-09-15",
    quantity: 5000,
    amount: 495000,
    status: "completed",
    closed: true,
    manager: "박자재",
    taxType: "부가세율 적용",
    warehouse: "본사창고",
    currency: "내자",
  },
  {
    id: "pu-011",
    purchaseDate: "2026-09-05",
    vendor: "그린로지스",
    item: "팔레트 랩 필름",
    dueDate: "2026-09-11",
    quantity: 60,
    amount: 858000,
    status: "in_progress",
    closed: false,
    manager: "이입고",
    taxType: "부가세율 적용",
    warehouse: "본사창고",
    currency: "내자",
  },
  {
    id: "pu-012",
    purchaseDate: "2026-09-05",
    vendor: "세진전자",
    item: "USB-C 허브 7포트",
    dueDate: "2026-09-22",
    quantity: 30,
    amount: 1485000,
    status: "approval",
    closed: false,
    manager: "김구매",
    taxType: "부가세율 적용",
    warehouse: "전자부품창고",
    currency: "엔화[400]",
  },
];

export function loadPurchases(): Purchase[] {
  if (typeof window === "undefined") return mockPurchases;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...mockPurchases];
    const parsed = JSON.parse(raw) as Purchase[];
    return Array.isArray(parsed) ? parsed : [...mockPurchases];
  } catch {
    return [...mockPurchases];
  }
}

export function savePurchases(rows: Purchase[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function appendPurchase(row: Purchase): Purchase[] {
  const next = [row, ...loadPurchases()];
  savePurchases(next);
  return next;
}

export function nextPurchaseId(): string {
  const rows = loadPurchases();
  let max = 0;
  for (const r of rows) {
    const m = /^pu-(\d+)$/i.exec(r.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `pu-${String(max + 1).padStart(3, "0")}`;
}

export interface PurchaseStatusAggRow {
  key: string;
  vendor: string;
  item: string;
  purchaseCount: number;
  quantitySum: number;
  amountSum: number;
  status: PurchaseStatus;
}

export interface PurchaseStatusSummary {
  count: number;
  quantitySum: number;
  amountSum: number;
  inProgressCount: number;
}

export function summarizePurchases(rows: Purchase[]): PurchaseStatusSummary {
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

/** Aggregate by vendor + item + status for 구매현황 */
export function aggregatePurchasesByVendorStatus(
  rows: Purchase[]
): PurchaseStatusAggRow[] {
  const map = new Map<string, PurchaseStatusAggRow>();
  for (const r of rows) {
    const key = `${r.vendor}\0${r.item}\0${r.status}`;
    const existing = map.get(key);
    if (existing) {
      existing.purchaseCount += 1;
      existing.quantitySum += r.quantity;
      existing.amountSum += r.amount;
    } else {
      map.set(key, {
        key,
        vendor: r.vendor,
        item: r.item,
        purchaseCount: 1,
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

export function countByPurchaseStatus(
  rows: Purchase[]
): { status: PurchaseStatus | "all"; label: string; count: number }[] {
  const counts: Record<PurchaseStatus, number> = {
    approval: 0,
    unconfirmed: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
  };
  for (const r of rows) counts[r.status] += 1;
  return PURCHASE_STATUS_TABS.map((t) => ({
    status: t.key,
    label: t.label,
    count: t.key === "all" ? rows.length : counts[t.key],
  }));
}

/** Default ~2 month range ending today (local) */
export function defaultPurchaseDateRange(today = new Date()): {
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

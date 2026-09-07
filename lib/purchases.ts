export type PurchaseStatus =
  | "approval"
  | "unconfirmed"
  | "confirmed";

export interface Purchase {
  id: string;
  /** 구매일자 */
  purchaseDate: string;
  /** 오더관리번호 */
  orderNo?: string;
  vendor: string;
  vendorCode?: string;
  item: string;
  /** 적요 */
  remarks?: string;
  quantity: number;
  amount: number;
  status: PurchaseStatus;
  manager?: string;
  /** 거래유형 */
  taxType?: string;
  /** 입고창고 */
  warehouse?: string;
  project?: string;
  /** 내외자/통화 */
  currency?: string;
  /** 발송여부 */
  sent?: boolean;
  /** 회계반영여부 */
  accountingReflect?: boolean;
  /** 인쇄 */
  printed?: boolean;
  /** 불러온전표 */
  importedSlip?: string;
}

export const PURCHASE_STATUS_TABS: {
  key: "all" | PurchaseStatus;
  label: string;
}[] = [
  { key: "all", label: "전체" },
  { key: "approval", label: "결재중" },
  { key: "unconfirmed", label: "미확인" },
  { key: "confirmed", label: "확인" },
];

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  approval: "결재중",
  unconfirmed: "미확인",
  confirmed: "확인",
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

export const SENT_FILTER_OPTIONS = [
  { key: "all", label: "전체" },
  { key: "sent", label: "발송" },
  { key: "unsent", label: "미발송" },
] as const;

export const SORT_OPTIONS = [
  "일자",
  "거래처",
  "품목",
  "금액",
] as const;

const STORAGE_KEY = "flowdesk-purchases";

/** Local mock rows for 구매조회 — not wired to Prisma/Neon */
export const mockPurchases: Purchase[] = [
  {
    id: "pu-001",
    purchaseDate: "2026-08-28",
    orderNo: "PO-260828-01",
    vendor: "한빛산업",
    vendorCode: "V001",
    item: "스테인리스 볼트 M8",
    remarks: "정기 소모품 구매",
    quantity: 2000,
    amount: 924000,
    status: "unconfirmed",
    manager: "김구매",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    sent: false,
    accountingReflect: false,
    printed: false,
    importedSlip: "",
  },
  {
    id: "pu-002",
    purchaseDate: "2026-08-29",
    orderNo: "PO-260829-02",
    vendor: "세진전자",
    vendorCode: "V002",
    item: "전원 어댑터 12V 5A",
    remarks: "생산라인 보급",
    quantity: 150,
    amount: 2475000,
    status: "approval",
    manager: "이입고",
    taxType: "과세",
    warehouse: "전자부품창고",
    currency: "내자",
    sent: true,
    accountingReflect: false,
    printed: true,
    importedSlip: "발주-002",
  },
  {
    id: "pu-003",
    purchaseDate: "2026-08-30",
    orderNo: "PO-260830-03",
    vendor: "동아포장",
    vendorCode: "V003",
    item: "골판지 박스 중형",
    remarks: "출하 포장재",
    quantity: 500,
    amount: 715000,
    status: "unconfirmed",
    manager: "김구매",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    sent: false,
    accountingReflect: false,
    printed: false,
  },
  {
    id: "pu-004",
    purchaseDate: "2026-09-01",
    orderNo: "PO-260901-04",
    vendor: "미래케미칼",
    vendorCode: "V004",
    item: "산업용 세척제 20L",
    remarks: "설비 세척",
    quantity: 40,
    amount: 1408000,
    status: "confirmed",
    manager: "박자재",
    taxType: "과세",
    warehouse: "화공창고",
    currency: "내자",
    sent: true,
    accountingReflect: true,
    printed: true,
  },
  {
    id: "pu-005",
    purchaseDate: "2026-09-01",
    orderNo: "PO-260901-05",
    vendor: "코리아베어링",
    vendorCode: "V005",
    item: "베어링 6204-2RS",
    remarks: "교체 부품",
    quantity: 300,
    amount: 1056000,
    status: "confirmed",
    manager: "이입고",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    sent: true,
    accountingReflect: true,
    printed: false,
    importedSlip: "발주-015",
  },
  {
    id: "pu-006",
    purchaseDate: "2026-09-02",
    orderNo: "PO-260902-06",
    vendor: "푸른물산",
    vendorCode: "V006",
    item: "PVC 파이프 50A",
    remarks: "",
    quantity: 120,
    amount: 594000,
    status: "unconfirmed",
    manager: "김구매",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    sent: false,
    accountingReflect: false,
    printed: false,
  },
  {
    id: "pu-007",
    purchaseDate: "2026-09-02",
    orderNo: "PO-260902-07",
    vendor: "스마트오피스",
    vendorCode: "V007",
    item: "A4 복사용지 80g",
    remarks: "사무용품",
    quantity: 50,
    amount: 192500,
    status: "unconfirmed",
    manager: "박자재",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    sent: false,
    accountingReflect: false,
    printed: false,
  },
  {
    id: "pu-008",
    purchaseDate: "2026-09-03",
    orderNo: "PO-260903-08",
    vendor: "남해철강",
    vendorCode: "V008",
    item: "각파이프 40x40",
    remarks: "프레임 제작",
    quantity: 80,
    amount: 2112000,
    status: "approval",
    manager: "이입고",
    taxType: "과세",
    warehouse: "철강야적",
    currency: "내자",
    sent: false,
    accountingReflect: false,
    printed: false,
  },
  {
    id: "pu-009",
    purchaseDate: "2026-09-03",
    orderNo: "PO-260903-09",
    vendor: "이노텍솔루션",
    vendorCode: "V009",
    item: "PLC 릴레이 모듈",
    remarks: "자동화 설비",
    quantity: 25,
    amount: 3437500,
    status: "confirmed",
    manager: "김구매",
    taxType: "과세",
    warehouse: "전자부품창고",
    currency: "달러[100]",
    sent: true,
    accountingReflect: true,
    printed: true,
  },
  {
    id: "pu-010",
    purchaseDate: "2026-09-04",
    orderNo: "PO-260904-10",
    vendor: "한빛산업",
    vendorCode: "V001",
    item: "육각너트 M10",
    remarks: "볼트 세트 보충",
    quantity: 5000,
    amount: 495000,
    status: "confirmed",
    manager: "박자재",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    sent: true,
    accountingReflect: true,
    printed: true,
  },
  {
    id: "pu-011",
    purchaseDate: "2026-09-05",
    orderNo: "PO-260905-11",
    vendor: "그린로지스",
    vendorCode: "V010",
    item: "팔레트 랩 필름",
    remarks: "물류 소모품",
    quantity: 60,
    amount: 858000,
    status: "approval",
    manager: "이입고",
    taxType: "과세",
    warehouse: "본사창고",
    currency: "내자",
    sent: false,
    accountingReflect: false,
    printed: false,
  },
  {
    id: "pu-012",
    purchaseDate: "2026-09-05",
    orderNo: "PO-260905-12",
    vendor: "세진전자",
    vendorCode: "V002",
    item: "USB-C 허브 7포트",
    remarks: "사무 IT",
    quantity: 30,
    amount: 1485000,
    status: "approval",
    manager: "김구매",
    taxType: "과세",
    warehouse: "전자부품창고",
    currency: "엔화[400]",
    sent: false,
    accountingReflect: false,
    printed: false,
    importedSlip: "발주-022",
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

export interface PurchaseStatusSummary {
  count: number;
  quantitySum: number;
  amountSum: number;
  confirmedCount: number;
}

export function summarizePurchases(rows: Purchase[]): PurchaseStatusSummary {
  let quantitySum = 0;
  let amountSum = 0;
  let confirmedCount = 0;
  for (const r of rows) {
    quantitySum += r.quantity;
    amountSum += r.amount;
    if (r.status === "confirmed") confirmedCount += 1;
  }
  return {
    count: rows.length,
    quantitySum,
    amountSum,
    confirmedCount,
  };
}

export function countByPurchaseStatus(
  rows: Purchase[]
): { status: PurchaseStatus | "all"; label: string; count: number }[] {
  const counts: Record<PurchaseStatus, number> = {
    approval: 0,
    unconfirmed: 0,
    confirmed: 0,
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

export type PurchaseRequestStatus =
  | "approval"
  | "unconfirmed"
  | "confirmed"
  | "in_progress"
  | "completed";

export interface PurchaseRequest {
  id: string;
  requestDate: string;
  vendor: string;
  item: string;
  dueDate: string;
  quantity: number;
  amount: number;
  status: PurchaseRequestStatus;
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

/** Local mock rows for 발주요청조회 — not wired to Prisma/Neon */
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

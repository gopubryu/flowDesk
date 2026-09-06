export type Warehouse = {
  code: string;
  name: string;
  memo?: string;
};

const STORAGE_KEY = "flowdesk-warehouses";

/** Seed Korean mock warehouses for 창고 찾기 */
export const SEED_WAREHOUSES: Warehouse[] = [
  {
    code: "W001",
    name: "본사창고",
    memo: "서울 본사",
  },
  {
    code: "W002",
    name: "판교물류센터",
    memo: "경기 성남",
  },
  {
    code: "W003",
    name: "부산항창고",
    memo: "부산 남구",
  },
  {
    code: "W004",
    name: "인천보세창고",
    memo: "인천 중구",
  },
  {
    code: "W005",
    name: "대구지점창고",
    memo: "대구 달서",
  },
  {
    code: "W006",
    name: "원자재창고",
    memo: "생산용",
  },
];

export function loadWarehouses(): Warehouse[] {
  if (typeof window === "undefined") return [...SEED_WAREHOUSES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveWarehouses(SEED_WAREHOUSES);
      return [...SEED_WAREHOUSES];
    }
    const parsed = JSON.parse(raw) as Warehouse[];
    return Array.isArray(parsed) ? parsed : [...SEED_WAREHOUSES];
  } catch {
    return [...SEED_WAREHOUSES];
  }
}

export function saveWarehouses(rows: Warehouse[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function upsertWarehouse(row: Warehouse): Warehouse[] {
  const code = row.code.trim();
  const name = row.name.trim();
  if (!code || !name) return loadWarehouses();
  const next = loadWarehouses().filter(
    (w) => w.code.toLowerCase() !== code.toLowerCase()
  );
  next.unshift({
    code,
    name,
    memo: row.memo?.trim() || undefined,
  });
  saveWarehouses(next);
  return next;
}

export function nextWarehouseCode(): string {
  const rows = loadWarehouses();
  let max = 0;
  for (const r of rows) {
    const m = /^W(\d+)$/i.exec(r.code.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `W${String(max + 1).padStart(3, "0")}`;
}

export function searchWarehouses(query: string): Warehouse[] {
  const q = query.trim().toLowerCase();
  const rows = loadWarehouses();
  if (!q) return rows;
  return rows.filter(
    (w) =>
      w.code.toLowerCase().includes(q) ||
      w.name.toLowerCase().includes(q) ||
      (w.memo && w.memo.toLowerCase().includes(q))
  );
}

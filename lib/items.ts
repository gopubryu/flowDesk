export type Item = {
  code: string;
  name: string;
  spec?: string;
  unit?: string;
};

const STORAGE_KEY = "flowdesk-items";

/** Seed Korean mock items for 품목 찾기 */
export const SEED_ITEMS: Item[] = [
  {
    code: "I001",
    name: "스테인리스 볼트 M8",
    spec: "M8×20",
    unit: "EA",
  },
  {
    code: "I002",
    name: "알루미늄 판재",
    spec: "2T×1000×2000",
    unit: "장",
  },
  {
    code: "I003",
    name: "산업용 윤활유",
    spec: "20L",
    unit: "통",
  },
  {
    code: "I004",
    name: "LED 패널 조명",
    spec: "60W",
    unit: "EA",
  },
  {
    code: "I005",
    name: "포장용 골판지 상자",
    spec: "중형",
    unit: "EA",
  },
  {
    code: "I006",
    name: "케이블 타이",
    spec: "200mm",
    unit: "봉",
  },
];

export function loadItems(): Item[] {
  if (typeof window === "undefined") return [...SEED_ITEMS];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveItems(SEED_ITEMS);
      return [...SEED_ITEMS];
    }
    const parsed = JSON.parse(raw) as Item[];
    return Array.isArray(parsed) ? parsed : [...SEED_ITEMS];
  } catch {
    return [...SEED_ITEMS];
  }
}

export function saveItems(rows: Item[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function upsertItem(row: Item): Item[] {
  const code = row.code.trim();
  const name = row.name.trim();
  if (!code || !name) return loadItems();
  const next = loadItems().filter(
    (i) => i.code.toLowerCase() !== code.toLowerCase()
  );
  next.unshift({
    code,
    name,
    spec: row.spec?.trim() || undefined,
    unit: row.unit?.trim() || undefined,
  });
  saveItems(next);
  return next;
}

export function nextItemCode(): string {
  const rows = loadItems();
  let max = 0;
  for (const r of rows) {
    const m = /^I(\d+)$/i.exec(r.code.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return "I" + String(max + 1).padStart(3, "0");
}

export function searchItems(query: string): Item[] {
  const q = query.trim().toLowerCase();
  const rows = loadItems();
  if (!q) return rows;
  return rows.filter(
    (i) =>
      i.code.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      (i.spec && i.spec.toLowerCase().includes(q)) ||
      (i.unit && i.unit.toLowerCase().includes(q))
  );
}

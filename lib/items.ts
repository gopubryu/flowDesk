export type Item = {
  code: string;
  name: string;
  spec?: string;
  unit?: string;
  /** 재고수량 */
  stockQty: number;
  /** 안전재고 (선택) */
  minStock?: number;
  /** 입고단가 */
  inboundPrice: number;
  /** 입고단가 VAT포함 */
  inboundVatIncluded: boolean;
  /** 출고단가 */
  outboundPrice: number;
  /** 출고단가 VAT포함 */
  outboundVatIncluded: boolean;
};

const STORAGE_KEY = "flowdesk-items";

function withDefaults(row: Partial<Item> & Pick<Item, "code" | "name">): Item {
  return {
    code: row.code,
    name: row.name,
    spec: row.spec,
    unit: row.unit,
    stockQty: typeof row.stockQty === "number" && !Number.isNaN(row.stockQty) ? row.stockQty : 0,
    minStock: typeof row.minStock === "number" && !Number.isNaN(row.minStock) ? row.minStock : undefined,
    inboundPrice:
      typeof row.inboundPrice === "number" && !Number.isNaN(row.inboundPrice)
        ? row.inboundPrice
        : 0,
    inboundVatIncluded: Boolean(row.inboundVatIncluded),
    outboundPrice:
      typeof row.outboundPrice === "number" && !Number.isNaN(row.outboundPrice)
        ? row.outboundPrice
        : 0,
    outboundVatIncluded: Boolean(row.outboundVatIncluded),
  };
}

/** Seed Korean mock items for 품목 찾기 */
export const SEED_ITEMS: Item[] = [
  withDefaults({
    code: "I001",
    name: "스테인리스 볼트 M8",
    spec: "M8×20",
    unit: "EA",
  }),
  withDefaults({
    code: "I002",
    name: "알루미늄 판재",
    spec: "2T×1000×2000",
    unit: "장",
  }),
  withDefaults({
    code: "I003",
    name: "산업용 윤활유",
    spec: "20L",
    unit: "통",
  }),
  withDefaults({
    code: "I004",
    name: "LED 패널 조명",
    spec: "60W",
    unit: "EA",
  }),
  withDefaults({
    code: "I005",
    name: "포장용 골판지 상자",
    spec: "중형",
    unit: "EA",
  }),
  withDefaults({
    code: "I006",
    name: "케이블 타이",
    spec: "200mm",
    unit: "봉",
  }),
];

export function loadItems(): Item[] {
  if (typeof window === "undefined") return SEED_ITEMS.map((i) => ({ ...i }));
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveItems(SEED_ITEMS);
      return SEED_ITEMS.map((i) => ({ ...i }));
    }
    const parsed = JSON.parse(raw) as Partial<Item>[];
    if (!Array.isArray(parsed)) return SEED_ITEMS.map((i) => ({ ...i }));
    return parsed
      .filter((r) => r && typeof r.code === "string" && typeof r.name === "string")
      .map((r) => withDefaults(r as Partial<Item> & Pick<Item, "code" | "name">));
  } catch {
    return SEED_ITEMS.map((i) => ({ ...i }));
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
  next.unshift(
    withDefaults({
      code,
      name,
      spec: row.spec?.trim() || undefined,
      unit: row.unit?.trim() || undefined,
      stockQty: row.stockQty,
      minStock: row.minStock,
      inboundPrice: row.inboundPrice,
      inboundVatIncluded: row.inboundVatIncluded,
      outboundPrice: row.outboundPrice,
      outboundVatIncluded: row.outboundVatIncluded,
    })
  );
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

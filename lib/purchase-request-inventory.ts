export type InventoryLookupRow = {
  itemCode: string;
  warehouseCode: string;
  qty: number;
};

export type InventoryLookup = {
  itemCodes: string[];
  warehouseCode: string;
};

export function buildInventoryLookup(itemCodes: string[], warehouseCode: string): InventoryLookup {
  const unique = [...new Set(itemCodes.map((code) => code.trim()).filter(Boolean))];
  const warehouse = warehouseCode.trim();
  return {
    itemCodes: warehouse ? unique : [],
    warehouseCode: warehouse,
  };
}

export function mergeInventoryRows(
  lines: { itemCode: string }[],
  rows: InventoryLookupRow[],
  warehouseCode: string
): { totalStock: number; warehouseStock: number }[] {
  const totals = new Map<string, number>();
  const selected = new Map<string, number>();
  for (const row of rows) {
    const code = row.itemCode.trim();
    if (!code) continue;
    totals.set(code, (totals.get(code) ?? 0) + row.qty);
    if (row.warehouseCode === warehouseCode) {
      selected.set(code, (selected.get(code) ?? 0) + row.qty);
    }
  }
  return lines.map((line) => ({
    totalStock: totals.get(line.itemCode.trim()) ?? 0,
    warehouseStock: selected.get(line.itemCode.trim()) ?? 0,
  }));
}

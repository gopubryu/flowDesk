export function validDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function finiteNonNegative(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

type ImportAmountInput = {
  currency: unknown;
  foreignAmount: unknown;
  customsExchangeRate: unknown;
  baseAmount: unknown;
  importVatBaseAmount: unknown;
  importVat: unknown;
};

function decimalParts(value: unknown) {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value.trim() : "";
  const match = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/.exec(text);
  return match ? { text, scale: match[1]?.length ?? 0, integerDigits: (match[0].split(".")[0] ?? "0").length } : null;
}

export function calculateImportBaseAmount(currency: unknown, foreignAmount: unknown, customsExchangeRate: unknown): string | null {
  const code = String(currency ?? "").trim().toUpperCase();
  const foreign = decimalParts(foreignAmount);
  const rate = decimalParts(customsExchangeRate);
  if (!foreign || !rate || (code !== "USD" && code !== "JPY")) return null;
  const foreignRaw = BigInt(foreign.text.replace(".", "").padEnd(2 + foreign.scale, "0"));
  const rateRaw = BigInt(rate.text.replace(".", "").padEnd(4 + rate.scale, "0"));
  const denominator = code === "JPY" ? BigInt("100000000") : BigInt("1000000");
  return ((foreignRaw * rateRaw + denominator / BigInt("2")) / denominator).toString();
}

export function validateImportAmounts(input: ImportAmountInput): string | null {
  const currency = String(input.currency ?? "").trim().toUpperCase();
  if (currency !== "USD" && currency !== "JPY") return "Currency must be USD or JPY.";
  const foreign = decimalParts(input.foreignAmount);
  if (!foreign || foreign.scale > (currency === "JPY" ? 0 : 2) || foreign.integerDigits > 16 || Number(foreign.text) < 0) return `foreignAmount must fit Decimal(18,2) with valid ${currency} precision.`;
  const rate = decimalParts(input.customsExchangeRate);
  if (!rate || Number(rate.text) <= 0 || rate.scale > 4 || rate.integerDigits > 8) return "customsExchangeRate must fit Decimal(12,4) and be greater than zero.";
  for (const [name, value] of [["baseAmount", input.baseAmount], ["importVatBaseAmount", input.importVatBaseAmount], ["importVat", input.importVat]] as const) {
    const amount = decimalParts(value);
    if (!amount || amount.scale > 0 || amount.integerDigits > 18 || Number(amount.text) < 0) return `${name} must fit Decimal(18,0) and be non-negative.`;
  }
  return null;
}

export function aggregateQtyByItem<T extends { itemCode: string; qty: number }>(lines: T[]) {
  const quantities = new Map<string, number>();
  for (const line of lines) quantities.set(line.itemCode, (quantities.get(line.itemCode) ?? 0) + line.qty);
  return quantities;
}

export function validateMovementQuantity(value: unknown): string | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return "Quantity is required.";
  const quantity = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(quantity)) return "Quantity must be a finite number.";
  if (quantity <= 0) return "Quantity must be greater than zero.";
  return null;
}

export function validateLinkedQuantities(
  plannedByItem: Map<string, number>,
  processedByItem: Map<string, number>,
  requestedByItem: Map<string, number>,
): string | null {
  for (const [itemCode, requested] of requestedByItem) {
    if (!Number.isFinite(requested)) return `Quantity for ${itemCode} must be a finite number.`;
    if (requested < 0) return `Quantity for ${itemCode} must be non-negative.`;
    const planned = plannedByItem.get(itemCode);
    if (planned === undefined) return `Unknown item code ${itemCode}.`;
    const processed = processedByItem.get(itemCode) ?? 0;
    if (!Number.isFinite(planned) || !Number.isFinite(processed) || processed < 0) return `Invalid linked quantity for ${itemCode}.`;
    if (requested > planned - processed + 1e-9) return `Requested quantity exceeds remaining quantity for ${itemCode}.`;
  }
  return null;
}

export function groupRelatedLines<T extends { relatedType?: string | null; relatedId?: string | null; itemCode: string; qty: number }>(lines: T[]) {
  const groups = new Map<string, Map<string, number>>();
  for (const line of lines) {
    if (!line.relatedType || !line.relatedId) continue;
    const key = `${line.relatedType}:${line.relatedId}`;
    const items = groups.get(key) ?? new Map<string, number>();
    items.set(line.itemCode, (items.get(line.itemCode) ?? 0) + line.qty);
    groups.set(key, items);
  }
  return groups;
}

export function adjustmentDelta(currentBalance: number, actualQty: number, clientBookQty?: number) {
  if (!finiteNonNegative(actualQty)) return { error: "Actual quantity must be a finite non-negative number." };
  if (clientBookQty !== undefined && (!finiteNonNegative(clientBookQty) || Math.abs(clientBookQty - currentBalance) > 1e-9)) return { error: "Inventory balance changed. Refresh and try again.", conflict: true };
  return { delta: actualQty - currentBalance };
}

export function canTransitionPurchaseRequest(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = { approval: ["unconfirmed"], unconfirmed: ["approval", "confirmed"], confirmed: ["in_progress"], in_progress: ["completed"], completed: [] };
  return from === to || allowed[from]?.includes(to) === true;
}

export function canTransitionPurchase(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    approval: ["unconfirmed"],
    unconfirmed: ["approval", "confirmed"],
    confirmed: [],
  };
  return from === to || allowed[from]?.includes(to) === true;
}

export function canDeletePurchase(_status: string, inboundStatus: string): boolean {
  return inboundStatus === "none";
}

export function validatePurchaseInput(vendor: string, lines: Array<{ itemCode: string | null; itemName: string; qty: number; unitPrice: number; supply: number; vat: number; total: number }>): string | null {
  if (!vendor.trim()) return "Vendor is required.";
  if (!lines.length) return "At least one purchase line is required.";
  for (const line of lines) {
    if (!line.itemCode?.trim() || !line.itemName.trim()) return "Each line requires an item code and name.";
    if (!Number.isFinite(line.qty) || line.qty <= 0) return "Each line quantity must be greater than zero.";
    for (const value of [line.unitPrice, line.supply, line.vat, line.total]) if (!finiteNonNegative(value)) return "Line money values must be finite and non-negative.";
  }
  return null;
}

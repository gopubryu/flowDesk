export function validDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function finiteNonNegative(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
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

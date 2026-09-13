export type SlipSourceType = "purchaseRequest" | "purchase" | "salesPlan" | "quotation";

export type ImportLine = {
  id?: string | null; itemCode?: string | null; itemName?: string | null; spec?: string | null;
  qty?: number | null; unitPrice?: number | null; supply?: number | null; vat?: number | null;
  total?: number | null; extra?: string | null; sortOrder?: number | null;
};

export type ImportSearchRow = {
  date?: string | Date | null; slipNo?: string | null; vendorName?: string | null;
  vendor?: string | null; item?: string | null; lines?: ImportLine[] | null;
};

export type ImportableSlip<T = unknown> = ImportSearchRow & {
  id: string; sourceType: SlipSourceType; sourceLabel: string; sourceSlipNo?: string | null; value: T;
};

export type SlipImportAdapter<T = unknown> = {
  sourceType: SlipSourceType; label: string; load: () => Promise<T[]>; normalize: (value: T) => ImportableSlip<T>;
};

export type SlipImportSource<T = unknown> = ImportableSlip<T>;

export function normalizeImportableSlip<T extends object>(
  value: T,
  config: { sourceType: SlipSourceType; sourceLabel: string; date: keyof T; vendor?: keyof T; item?: keyof T; lines?: keyof T; slipNo?: keyof T },
): ImportableSlip<T> {
  const record = value as Record<string, unknown>;
  const rawLines = config.lines ? record[config.lines as string] : undefined;
  const lines = Array.isArray(rawLines) ? [...rawLines] as ImportLine[] : [];
  const date = record[config.date as string] as string | Date | null | undefined;
  const vendor = config.vendor ? record[config.vendor as string] : undefined;
  const item = config.item ? record[config.item as string] : undefined;
  const slipNo = config.slipNo ? record[config.slipNo as string] : undefined;
  return {
    id: String(record.id ?? ""), sourceType: config.sourceType, sourceLabel: config.sourceLabel,
    sourceSlipNo: slipNo == null ? null : String(slipNo),
    date, slipNo: slipNo == null ? null : String(slipNo),
    vendorName: vendor == null ? null : String(vendor), vendor: vendor == null ? null : String(vendor),
    item: item == null ? null : String(item), lines, value,
  };
}

export function todayDateOnly(now = new Date()): string {
  const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, "0"); const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function matchesSlipImport(row: ImportSearchRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase(); if (!needle) return true;
  const date = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date ?? "";
  const haystack = [date, row.slipNo, row.vendorName, row.vendor, row.item, ...(row.lines ?? []).flatMap((line) => [line.itemCode, line.itemName])]
    .filter(Boolean).join(" ").toLocaleLowerCase();
  return haystack.includes(needle);
}

export function hasNonEmptyBusinessFormData(header: Record<string, unknown>, lines: Array<Record<string, unknown>>): boolean {
  const hasValue = (value: unknown) => typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
  return Object.values(header).some(hasValue) || lines.some((line) => Object.entries(line).some(([key, value]) => key !== "id" && key !== "checked" && hasValue(value)));
}

function withoutCopyIdentity<T extends Record<string, unknown>>(source: T) {
  const { id: _id, slipNo: _slipNo, createdAt: _createdAt, updatedAt: _updatedAt, ...header } = source; return header;
}

export function copyPurchaseRequestToDraft<T extends Record<string, unknown>>(source: T, date = todayDateOnly()) {
  return { ...withoutCopyIdentity(source), requestDate: date, status: "unconfirmed", slipNo: undefined };
}
export function copySalesPlanToDraft<T extends Record<string, unknown>>(source: T, date = todayDateOnly()) {
  return { ...withoutCopyIdentity(source), planDate: date, status: "confirmed", outboundStatus: "none", slipNo: undefined };
}
export function copyPurchaseToDraft<T extends Record<string, unknown>>(source: T, sourceType: "purchaseRequest" | "purchase", date = todayDateOnly()) {
  const reference = String(source.slipNo ?? source.id ?? "");
  return { ...withoutCopyIdentity(source), purchaseDate: date, status: "unconfirmed", inboundStatus: "none", slipNo: undefined, importedSlip: `${sourceType === "purchaseRequest" ? "발주요청" : "구매"}: ${reference}` };
}

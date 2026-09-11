type ImportLine = { itemCode?: string | null; itemName?: string | null };

export type ImportSearchRow = {
  date?: string | Date | null;
  slipNo?: string | null;
  vendorName?: string | null;
  vendor?: string | null;
  item?: string | null;
  lines?: ImportLine[] | null;
};

export function todayDateOnly(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function matchesSlipImport(row: ImportSearchRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const date = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date ?? "";
  const haystack = [date, row.slipNo, row.vendorName, row.vendor, row.item, ...(row.lines ?? []).flatMap((line) => [line.itemCode, line.itemName])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return haystack.includes(needle);
}

/** True when importing would replace user-entered header or line business data. */
export function hasNonEmptyBusinessFormData(
  header: Record<string, unknown>,
  lines: Array<Record<string, unknown>>,
): boolean {
  const hasValue = (value: unknown) =>
    typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
  return Object.values(header).some(hasValue) || lines.some((line) =>
    Object.entries(line).some(([key, value]) => key !== "id" && key !== "checked" && hasValue(value)),
  );
}

function withoutCopyIdentity<T extends Record<string, unknown>>(source: T) {
  const { id: _id, slipNo: _slipNo, createdAt: _createdAt, updatedAt: _updatedAt, ...header } = source;
  return header;
}

export function copyPurchaseRequestToDraft<T extends Record<string, unknown>>(source: T, date = todayDateOnly()) {
  return { ...withoutCopyIdentity(source), requestDate: date, status: "unconfirmed", slipNo: undefined };
}

export function copySalesPlanToDraft<T extends Record<string, unknown>>(source: T, date = todayDateOnly()) {
  return { ...withoutCopyIdentity(source), planDate: date, status: "confirmed", outboundStatus: "none", slipNo: undefined };
}

export function copyPurchaseToDraft<T extends Record<string, unknown>>(source: T, sourceType: "purchaseRequest" | "purchase", date = todayDateOnly()) {
  const reference = String(source.slipNo ?? source.id ?? "");
  return {
    ...withoutCopyIdentity(source),
    purchaseDate: date,
    status: "unconfirmed",
    inboundStatus: "none",
    slipNo: undefined,
    importedSlip: `${sourceType === "purchaseRequest" ? "발주요청" : "구매"}: ${reference}`,
  };
}

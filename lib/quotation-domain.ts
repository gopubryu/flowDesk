export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export type QuotationLineInput = {
  itemCode?: unknown;
  itemName?: unknown;
  spec?: unknown;
  unit?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
  extra?: unknown;
  sortOrder?: unknown;
};

export type NormalizedQuotationLine = {
  itemCode: string | null;
  itemName: string;
  spec: string | null;
  unit: string | null;
  qty: number;
  unitPrice: number;
  extra: string | null;
  sortOrder: number;
};

export type NormalizedQuotationInput = {
  quoteDate: string;
  slipNo: string | null;
  vendorCode: string | null;
  vendorName: string;
  managerCode: string | null;
  managerName: string | null;
  validUntil: string | null;
  status: QuotationStatus;
  taxType: string | null;
  currency: string | null;
  project: string | null;
  remarks: string | null;
  lines: NormalizedQuotationLine[];
};

export class QuotationValidationError extends Error {}

const statuses: QuotationStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];
const text = (value: unknown) => String(value ?? "").trim();
const optional = (value: unknown) => text(value) || null;
const code = (value: unknown) => optional(value)?.toUpperCase() ?? null;

function number(value: unknown, label: string, minimum: number) {
  if (value === null || value === undefined || value === "") {
    throw new QuotationValidationError(`${label} is required`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new QuotationValidationError(`${label} must be ${minimum === 0 ? "non-negative" : "greater than zero"}`);
  }
  return parsed;
}

function date(value: unknown, label: string, required = false) {
  const input = text(value);
  if (!input && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(new Date(`${input}T12:00:00.000Z`).getTime())) {
    throw new QuotationValidationError(`${label} must be a valid date`);
  }
  return input;
}

export function normalizeQuotationInput(body: unknown): NormalizedQuotationInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new QuotationValidationError("Invalid request body");
  const row = body as Record<string, unknown>;
  const status = text(row.status || "draft") as QuotationStatus;
  if (!statuses.includes(status)) throw new QuotationValidationError("Invalid quotation status");
  const vendorName = text(row.vendorName ?? row.vendor);
  if (!vendorName) throw new QuotationValidationError("vendorName is required");
  if (!Array.isArray(row.lines) || row.lines.length === 0) throw new QuotationValidationError("At least one quotation line is required");
  const seen = new Set<string>();
  const lines = row.lines.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new QuotationValidationError("Invalid quotation line");
    const line = raw as QuotationLineInput;
    const itemCode = code(line.itemCode);
    const itemName = text(line.itemName);
    if (!itemCode && !itemName) throw new QuotationValidationError("itemCode or itemName is required");
    const duplicateKey = itemCode ?? `name:${itemName.toLocaleLowerCase()}`;
    if (seen.has(duplicateKey)) throw new QuotationValidationError("Duplicate quotation item line");
    seen.add(duplicateKey);
    return {
      itemCode,
      itemName: itemName || itemCode!,
      spec: optional(line.spec),
      unit: optional(line.unit),
      qty: number(line.qty, "qty", Number.MIN_VALUE),
      unitPrice: number(line.unitPrice, "unitPrice", 0),
      extra: optional(line.extra),
      sortOrder: typeof line.sortOrder === "number" && Number.isInteger(line.sortOrder) ? line.sortOrder : index,
    };
  });
  return {
    quoteDate: date(row.quoteDate, "quoteDate", true)!,
    slipNo: optional(row.slipNo),
    vendorCode: code(row.vendorCode),
    vendorName,
    managerCode: code(row.managerCode),
    managerName: optional(row.managerName),
    validUntil: date(row.validUntil, "validUntil"),
    status,
    taxType: optional(row.taxType),
    currency: optional(row.currency),
    project: optional(row.project),
    remarks: optional(row.remarks),
    lines,
  };
}

export function calculateQuotationTotals(lines: NormalizedQuotationLine[], taxType: string | null) {
  const calculated = lines.map((line, index) => {
    const supply = Math.round(line.qty * line.unitPrice);
    const vat = taxType === "과세" ? Math.round(supply * 0.1) : 0;
    return { ...line, supply, vat, total: supply + vat, sortOrder: line.sortOrder ?? index };
  });
  return {
    quantity: calculated.reduce((sum, line) => sum + line.qty, 0),
    amount: calculated.reduce((sum, line) => sum + line.supply, 0),
    vat: calculated.reduce((sum, line) => sum + line.vat, 0),
    total: calculated.reduce((sum, line) => sum + line.total, 0),
    lines: calculated,
  };
}

export function assertQuotationMutable(status: QuotationStatus, changes: { linesChanged?: boolean; amountChanged?: boolean; slipNoChanged?: boolean }) {
  if (status === "rejected" || status === "expired") throw new QuotationValidationError("This quotation is no longer editable");
  if (status === "accepted" && (changes.linesChanged || changes.amountChanged || changes.slipNoChanged)) {
    throw new QuotationValidationError("Accepted quotations cannot change items, amounts, or quotation number");
  }
}

export function assertQuotationConvertible(quotation: { status: QuotationStatus; validUntil: string | Date | null; convertedSalesPlanId: string | null }, now = new Date()) {
  if (quotation.convertedSalesPlanId) throw new QuotationValidationError("Quotation has already been converted");
  if (quotation.status !== "accepted") throw new QuotationValidationError("Only accepted quotations can be converted");
  if (quotation.validUntil) {
    const validUntil = new Date(`${String(quotation.validUntil).slice(0, 10)}T23:59:59.999Z`);
    if (validUntil < now) throw new QuotationValidationError("Quotation has expired");
  }
}

export function canTransitionQuotation(from: QuotationStatus, to: QuotationStatus, validUntil?: string | Date | null, now = new Date()) {
  if (from === to) return true;
  if ((from === "draft" || from === "sent") && to === "expired" && validUntil) {
    return new Date(`${String(validUntil).slice(0, 10)}T23:59:59.999Z`) < now;
  }
  return (from === "draft" && to === "sent") || (from === "sent" && (to === "accepted" || to === "rejected"));
}

export function nextQuotationSlipNo(quoteDate: string, existingSlipNos: Array<string | null | undefined>) {
  const dateKey = quoteDate.replaceAll("-", "");
  const prefix = `QT-${dateKey}-`;
  const max = existingSlipNos.reduce((current, slipNo) => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(String(slipNo ?? ""));
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

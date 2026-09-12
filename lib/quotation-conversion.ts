type QuotationForConversion = {
  id: string;
  quoteDate: Date;
  slipNo: string;
  vendorCode: string | null;
  vendorName: string;
  managerName: string | null;
  taxType: string | null;
  currency: string | null;
  project: string | null;
  item: string;
  itemCode: string | null;
  quantity: number;
  amount: number;
  vat: number;
  total: number;
  lines: Array<{ itemCode: string | null; itemName: string; spec: string | null; unit: string | null; qty: number; unitPrice: number; supply: number; vat: number; total: number; extra: string | null; sortOrder: number }>;
};

/** Builds only SalesPlan header/line data; it intentionally never posts inventory. */
export function quotationToSalesPlanData(quotation: QuotationForConversion) {
  return {
    sourceQuotationId: quotation.id,
    planDate: quotation.quoteDate,
    vendorCode: quotation.vendorCode,
    vendorName: quotation.vendorName,
    item: quotation.item,
    itemCode: quotation.itemCode,
    spec: quotation.lines[0]?.spec ?? null,
    quantity: quotation.quantity,
    unitPrice: quotation.lines[0]?.unitPrice ?? 0,
    amount: quotation.amount,
    vat: quotation.vat,
    total: quotation.total,
    status: "confirmed" as const,
    outboundStatus: "none" as const,
    manager: quotation.managerName,
    taxType: quotation.taxType,
    project: quotation.project,
    currency: quotation.currency,
    dueDate: null,
    lines: { create: quotation.lines.map((line) => ({ itemCode: line.itemCode, itemName: line.itemName, spec: line.spec, qty: line.qty, unitPrice: line.unitPrice, supply: line.supply, vat: line.vat, total: line.total, extra: line.extra, sortOrder: line.sortOrder })) },
  };
}

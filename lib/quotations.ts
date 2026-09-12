import { masterDataRequest } from "@/lib/master-data-client";

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type QuotationLine = { id?: string; itemCode?: string; itemName: string; spec?: string; unit?: string; qty: number; unitPrice: number; supply: number; vat: number; total: number; extra?: string; sortOrder: number };
export type Quotation = { id: string; quoteDate: string; slipNo: string; vendorCode?: string; vendorName: string; managerCode?: string; managerName?: string; warehouseCode?: string; warehouseName?: string; validUntil?: string; status: QuotationStatus; taxType?: string; currency?: string; project?: string; remarks?: string; item: string; itemCode?: string; quantity: number; amount: number; vat: number; total: number; convertedSalesPlanId?: string; convertedSalesPlanSlipNo?: string; lines?: QuotationLine[] };
export type QuotationInput = Omit<Quotation, "id" | "item" | "itemCode" | "quantity" | "amount" | "vat" | "total"> & { id?: string; lines: QuotationLine[] };
export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = { draft: "작성중", sent: "발송", accepted: "수락", rejected: "거절", expired: "만료" };
export const TAX_TYPE_OPTIONS = ["과세", "영세", "면세"] as const;
export const CURRENCY_OPTIONS = ["내자", "달러[100]", "엔화[400]", "위안", "유로"] as const;

export function formatQuotationNo(quotation: Pick<Quotation, "slipNo">) { return quotation.slipNo || "—"; }
export function defaultQuotationDateRange(today = new Date()) { const to = new Date(today.getFullYear(), today.getMonth(), today.getDate()); const from = new Date(to); from.setMonth(from.getMonth() - 2); const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; return { from: format(from), to: format(to) }; }

export async function fetchQuotations(filters: { from?: string; to?: string; status?: string; query?: string } = {}) { const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]); return masterDataRequest<Quotation[]>(`/api/quotations${params.size ? `?${params}` : ""}`); }
export async function fetchQuotation(id: string) { return masterDataRequest<Quotation>(`/api/quotations/${id}`); }
export async function saveQuotation(input: QuotationInput) { const { id, ...body } = input; return masterDataRequest<Quotation>(id ? `/api/quotations/${id}` : "/api/quotations", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) }); }
export async function updateQuotationStatus(id: string, status: QuotationStatus) { return masterDataRequest<Quotation>(`/api/quotations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
export async function deleteQuotation(id: string) { return masterDataRequest<{ ok: true }>(`/api/quotations/${id}`, { method: "DELETE" }); }
export async function convertQuotation(id: string) { return masterDataRequest<{ id: string; slipNo?: string; sourceQuotationId: string }>(`/api/quotations/${id}/convert-to-sales-plan`, { method: "POST" }); }

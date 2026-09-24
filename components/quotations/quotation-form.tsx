"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceRole } from "@/lib/use-workspace-role";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberWithComma, parseNumberInput } from "@/lib/format";
import {
  deleteQuotation,
  fetchQuotation,
  saveQuotation,
  TAX_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  QUOTATION_STATUS_LABEL,
  type Quotation,
  type QuotationInput,
  type QuotationLine,
  type QuotationStatus,
  updateQuotationStatus,
} from "@/lib/quotations";
import { formatCurrencyLabel } from "@/lib/purchase-requests";
import { VendorSearchDialog } from "@/components/vendors/vendor-search-dialog";
import { EmployeeSearchDialog } from "@/components/employees/employee-search-dialog";
import { WarehouseSearchDialog } from "@/components/warehouses/warehouse-search-dialog";
import { ItemSearchDialog } from "@/components/items/item-search-dialog";
import type { Vendor } from "@/lib/vendors";
import type { Employee } from "@/lib/employees";
import type { Warehouse } from "@/lib/warehouses";
import type { Item } from "@/lib/items";

type Props = { id?: string };
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (index = 0): QuotationLine => ({ itemCode: "", itemName: "", spec: "", unit: "", qty: 1, unitPrice: 0, supply: 0, vat: 0, total: 0, extra: "", sortOrder: index });

const fieldCls =
  "h-7 rounded border border-slate-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-indigo-500";
const labelCls =
  "flex h-7 min-w-[72px] shrink-0 items-center bg-slate-100 px-2 text-[11px] font-medium text-slate-600";

const STATUS_DESCRIPTION: Record<QuotationStatus, string> = {
  draft: "작성중 — 아직 거래처에 발송하지 않은 임시 저장 상태입니다. 자유롭게 수정할 수 있습니다.",
  sent: "발송 — 거래처에 견적을 전달한 상태입니다. 거래처의 수락/거절을 기다립니다.",
  accepted: "수락 — 거래처가 견적을 수락했습니다. 이 상태에서만 판매계획으로 전환할 수 있습니다. 품목·금액·번호는 변경할 수 없습니다.",
  rejected: "거절 — 거래처가 견적을 거절했습니다. 더 이상 수정할 수 없습니다.",
  expired: "만료 — 유효기간이 지나 자동으로 만료 처리되었습니다. 더 이상 수정할 수 없습니다.",
};

function CodeNameField({
  label,
  code,
  name,
  onSearch,
  disabled,
}: {
  label: string;
  code: string;
  name: string;
  onSearch: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
      <span className={labelCls}>{label}</span>
      <Input
        className={cn(fieldCls, "w-[72px] shrink-0 rounded-none border-0 border-r border-slate-200 bg-slate-50 text-slate-600")}
        value={code}
        readOnly
        placeholder="코드"
        aria-label={`${label} 코드`}
      />
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center border-r border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onSearch}
        disabled={disabled}
        aria-label={`${label} 검색`}
      >
        <Search className="h-3 w-3" />
      </button>
      <Input
        className={cn(fieldCls, "min-w-0 flex-1 rounded-none border-0 bg-slate-50 text-slate-600")}
        value={name}
        readOnly
        placeholder={`${label}명`}
        aria-label={`${label} 명칭`}
      />
    </div>
  );
}

function CommaLineInput({
  value,
  onChange,
  className,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const raw = value === 0 ? "" : String(value);
  const display = focused ? raw : formatNumberWithComma(raw);
  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={display}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(Number(parseNumberInput(e.target.value)) || 0)}
    />
  );
}

export function QuotationForm({ id }: Props) {
  const router = useRouter(); const edit = Boolean(id);
  const [header, setHeader] = useState({ quoteDate: today(), slipNo: "", vendorCode: "", vendorName: "", managerCode: "", managerName: "", warehouseCode: "", warehouseName: "", validUntil: "", status: "draft" as QuotationStatus, taxType: "과세", currency: "내자", project: "", remarks: "" });
  const [lines, setLines] = useState<QuotationLine[]>([emptyLine()]); const [loading, setLoading] = useState(edit); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const { canWrite: allowWrite, canDelete: allowDelete } = useWorkspaceRole();
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [warehouseSearchOpen, setWarehouseSearchOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemSearchIndex, setItemSearchIndex] = useState<number | null>(null);
  const readOnly = !allowWrite || header.status === "accepted" || header.status === "rejected" || header.status === "expired";
  const linesLocked = header.status === "accepted"; // accepted quotations lock items/amounts but header stays viewable

  useEffect(() => { if (!id) return; void fetchQuotation(id).then((row) => { setHeader({ quoteDate: row.quoteDate, slipNo: row.slipNo, vendorCode: row.vendorCode ?? "", vendorName: row.vendorName, managerCode: row.managerCode ?? "", managerName: row.managerName ?? "", warehouseCode: row.warehouseCode ?? "", warehouseName: row.warehouseName ?? "", validUntil: row.validUntil ?? "", status: row.status, taxType: row.taxType ?? "과세", currency: row.currency ?? "내자", project: row.project ?? "", remarks: row.remarks ?? "" }); setLines(row.lines?.length ? row.lines : [emptyLine()]); }).catch((err) => setError(err instanceof Error ? err.message : "견적서를 불러오지 못했습니다.")).finally(() => setLoading(false)); }, [id]);
  const calculated = useMemo(() => lines.map((line, index) => { const supply = Math.round((Number(line.qty) || 0) * (Number(line.unitPrice) || 0)); const vat = header.taxType === "과세" ? Math.round(supply * .1) : 0; return { ...line, supply, vat, total: supply + vat, sortOrder: index }; }), [lines, header.taxType]);
  const totals = useMemo(() => calculated.reduce((sum, line) => ({ qty: sum.qty + line.qty, supply: sum.supply + line.supply, vat: sum.vat + line.vat, total: sum.total + line.total }), { qty: 0, supply: 0, vat: 0, total: 0 }), [calculated]);
  const updateLine = (index: number, patch: Partial<QuotationLine>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));

  function selectVendor(vendor: Vendor) { setHeader((current) => ({ ...current, vendorCode: vendor.code, vendorName: vendor.name })); }
  function selectEmployee(employee: Employee) { setHeader((current) => ({ ...current, managerCode: employee.code, managerName: employee.name })); }
  function selectWarehouse(warehouse: Warehouse) { setHeader((current) => ({ ...current, warehouseCode: warehouse.code, warehouseName: warehouse.name })); }
  function selectItem(item: Item) { if (itemSearchIndex === null) return; updateLine(itemSearchIndex, { itemCode: item.code, itemName: item.name, spec: item.spec ?? "", unit: item.unit ?? "", unitPrice: item.outboundPrice ?? 0 }); setItemSearchIndex(null); }

  async function persist(status = header.status) { setError(""); if (!header.vendorName.trim()) return setError("거래처를 선택하세요."); if (!calculated.some((line) => line.itemCode || line.itemName)) return setError("품목 행을 하나 이상 입력하세요."); setSaving(true); try { const payload: QuotationInput = { id, ...header, status, lines: calculated.filter((line) => line.itemCode || line.itemName) }; const saved = await saveQuotation(payload); if (!edit) router.replace(`/quotations/${saved.id}`); else { setHeader((current) => ({ ...current, status: saved.status, slipNo: saved.slipNo })); setLines(saved.lines ?? calculated); } } catch (err) { setError(err instanceof Error ? err.message : "저장에 실패했습니다."); } finally { setSaving(false); } }
  async function changeStatus(status: QuotationStatus) { try { const saved = await updateQuotationStatus(id!, status); setHeader((current) => ({ ...current, status: saved.status })); } catch (err) { setError(err instanceof Error ? err.message : "상태 변경에 실패했습니다."); } }
  async function remove() { if (!id || !confirm("이 견적서를 삭제할까요?")) return; try { await deleteQuotation(id); router.push("/quotations"); } catch (err) { setError(err instanceof Error ? err.message : "삭제에 실패했습니다."); } }
  function addRow() { setLines((current) => [...current, emptyLine(current.length)]); }
  function removeRow(index: number) { setLines((current) => current.length === 1 ? current : current.filter((_, i) => i !== index)); }

  if (loading) return <p className="text-sm text-muted-foreground">견적서를 불러오는 중…</p>;

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      <div className="mb-2 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">견적서입력{edit ? " (수정)" : ""}</h2>
          <p className="text-xs text-muted-foreground">견적 저장과 판매계획 전환은 재고 수불과 잔고를 변경하지 않습니다.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => router.push("/quotations")}>목록</Button>
          {edit && <Button type="button" size="sm" variant="outline" className="h-8" onClick={remove} disabled={readOnly || !allowDelete}>삭제</Button>}
          <Button type="button" size="sm" className="h-8" onClick={() => void persist()} disabled={saving || readOnly}>{saving ? "저장 중…" : "저장"}</Button>
        </div>
      </div>

      {error && <p className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Master header */}
        <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>견적일</span>
              <Input type="date" className={cn(fieldCls, "rounded-none border-0")} value={header.quoteDate} disabled={readOnly} onChange={(e) => setHeader({ ...header, quoteDate: e.target.value })} />
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>견적번호</span>
              <Input className={cn(fieldCls, "rounded-none border-0 bg-slate-50 text-slate-500")} value={header.slipNo || "저장 시 자동발급"} readOnly />
            </div>

            <CodeNameField label="담당자" code={header.managerCode} name={header.managerName} onSearch={() => setEmployeeSearchOpen(true)} disabled={readOnly} />
            <CodeNameField label="거래처" code={header.vendorCode} name={header.vendorName} onSearch={() => setVendorSearchOpen(true)} disabled={readOnly} />
            <CodeNameField label="창고" code={header.warehouseCode} name={header.warehouseName} onSearch={() => setWarehouseSearchOpen(true)} disabled={readOnly} />

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>과세구분</span>
              <select className={cn(fieldCls, "w-full rounded-none border-0 bg-white")} value={header.taxType} disabled={readOnly} onChange={(e) => setHeader({ ...header, taxType: e.target.value })}>
                {TAX_TYPE_OPTIONS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>통화</span>
              <select className={cn(fieldCls, "w-full rounded-none border-0 bg-white")} value={header.currency} disabled={readOnly} onChange={(e) => setHeader({ ...header, currency: e.target.value })}>
                {CURRENCY_OPTIONS.map((value) => <option key={value}>{formatCurrencyLabel(value)}</option>)}
              </select>
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>유효기간</span>
              <Input type="date" className={cn(fieldCls, "rounded-none border-0")} value={header.validUntil} disabled={readOnly} onChange={(e) => setHeader({ ...header, validUntil: e.target.value })} />
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>프로젝트</span>
              <Input className={cn(fieldCls, "rounded-none border-0")} value={header.project} disabled={readOnly} onChange={(e) => setHeader({ ...header, project: e.target.value })} />
            </div>

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200 md:col-span-2" title={STATUS_DESCRIPTION[header.status]}>
              <span className={labelCls}>상태</span>
              <div className={cn(fieldCls, "flex flex-1 items-center gap-2 rounded-none border-0 bg-slate-50")}>
                <span className="font-medium text-slate-800">{QUOTATION_STATUS_LABEL[header.status]}</span>
                <span className="truncate text-slate-500">{STATUS_DESCRIPTION[header.status]}</span>
              </div>
            </div>

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200 md:col-span-2">
              <span className={labelCls}>비고</span>
              <Input className={cn(fieldCls, "rounded-none border-0")} value={header.remarks} disabled={readOnly} onChange={(e) => setHeader({ ...header, remarks: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
          <div className="ml-auto flex gap-1">
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={addRow} disabled={readOnly}>
              <Plus className="h-3 w-3" />행추가
            </Button>
          </div>
        </div>

        {/* Line grid */}
        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          <table className="w-full min-w-[1020px] border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-indigo-50/80 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="min-w-[88px] px-2 py-1.5">품목코드</th>
                <th className="min-w-[140px] px-2 py-1.5">품목명</th>
                <th className="min-w-[80px] px-2 py-1.5">규격</th>
                <th className="min-w-[64px] px-2 py-1.5">단위</th>
                <th className="min-w-[72px] px-2 py-1.5 text-right">수량</th>
                <th className="min-w-[88px] px-2 py-1.5 text-right">단가</th>
                <th className="min-w-[96px] px-2 py-1.5 text-right">공급가액</th>
                <th className="min-w-[80px] px-2 py-1.5 text-right">부가세</th>
                <th className="min-w-[96px] px-2 py-1.5 text-right">합계</th>
                <th className="min-w-[100px] px-2 py-1.5 font-medium text-slate-400 normal-case">비고</th>
                <th className="w-8 px-1 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {calculated.map((line, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-indigo-50/30">
                  <td className="px-1 py-0.5">
                    <Input
                      className="h-7 rounded border-slate-200 px-1.5 text-[11px] focus-visible:ring-1 focus-visible:ring-indigo-500"
                      value={line.itemCode ?? ""}
                      readOnly
                      placeholder="코드"
                      disabled={linesLocked}
                      onDoubleClick={() => { if (readOnly) return; setItemSearchIndex(index); setItemSearchOpen(true); }}
                      title="더블클릭하여 품목 검색"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <div className="flex items-stretch gap-1">
                      <Input className="h-7 min-w-0 flex-1 rounded border-slate-200 px-1.5 text-[11px] focus-visible:ring-1 focus-visible:ring-indigo-500" value={line.itemName ?? ""} readOnly placeholder="품목명" />
                      <button type="button" className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setItemSearchIndex(index); setItemSearchOpen(true); }} disabled={readOnly} aria-label="품목 검색">
                        <Search className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-1 py-0.5"><Input className="h-7 rounded border-slate-200 px-1.5 text-[11px]" value={line.spec ?? ""} readOnly /></td>
                  <td className="px-1 py-0.5"><Input className="h-7 rounded border-slate-200 px-1.5 text-[11px]" value={line.unit ?? ""} readOnly /></td>
                  <td className="px-1 py-0.5"><CommaLineInput className="h-7 rounded border-slate-200 px-1.5 text-right text-[11px] tabular-nums focus-visible:ring-1 focus-visible:ring-indigo-500" value={line.qty} disabled={readOnly} onChange={(n) => updateLine(index, { qty: n })} /></td>
                  <td className="px-1 py-0.5"><CommaLineInput className="h-7 rounded border-slate-200 px-1.5 text-right text-[11px] tabular-nums focus-visible:ring-1 focus-visible:ring-indigo-500" value={line.unitPrice} disabled={readOnly} onChange={(n) => updateLine(index, { unitPrice: n })} /></td>
                  <td className="px-2 py-0.5 text-right tabular-nums">{line.supply.toLocaleString()}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums">{line.vat.toLocaleString()}</td>
                  <td className="px-2 py-0.5 text-right font-medium tabular-nums">{line.total.toLocaleString()}</td>
                  <td className="px-1 py-0.5"><Input className="h-7 rounded border-dashed border-slate-200 bg-slate-50/50 px-1.5 text-[11px] placeholder:text-slate-300" value={line.extra ?? ""} disabled={readOnly} onChange={(e) => updateLine(index, { extra: e.target.value })} /></td>
                  <td className="px-1 py-0.5 text-center">
                    <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => removeRow(index)} disabled={readOnly || lines.length === 1} aria-label="행 삭제">
                      <X className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td colSpan={4} className="px-3 py-2 text-right text-[11px] text-slate-500">합계</td>
                <td className="px-2 py-2 text-right tabular-nums">{totals.qty.toLocaleString()}</td>
                <td />
                <td className="px-2 py-2 text-right tabular-nums">{totals.supply.toLocaleString()}</td>
                <td className="px-2 py-2 text-right tabular-nums">{totals.vat.toLocaleString()}</td>
                <td className="px-2 py-2 text-right tabular-nums text-indigo-700">{totals.total.toLocaleString()}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer actions */}
        {edit && !readOnly && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="ml-1 text-[11px] text-muted-foreground">상태 변경</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void changeStatus("sent")} disabled={header.status !== "draft"}>발송 처리</Button>
              <Button type="button" size="sm" className="h-8" onClick={() => void changeStatus("accepted")} disabled={header.status !== "sent"}>수락</Button>
              <Button type="button" size="sm" variant="destructive" className="h-8" onClick={() => void changeStatus("rejected")} disabled={header.status !== "sent"}>거절</Button>
            </div>
          </div>
        )}
      </div>

      <VendorSearchDialog open={vendorSearchOpen} onOpenChange={setVendorSearchOpen} onSelect={selectVendor} />
      <EmployeeSearchDialog open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen} onSelect={selectEmployee} />
      <WarehouseSearchDialog open={warehouseSearchOpen} onOpenChange={setWarehouseSearchOpen} onSelect={selectWarehouse} />
      <ItemSearchDialog open={itemSearchOpen} onOpenChange={(open) => { setItemSearchOpen(open); if (!open) setItemSearchIndex(null); }} onSelect={selectItem} />
    </div>
  );
}

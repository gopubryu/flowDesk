"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Paperclip,
  Plus,
  Search,
  ArrowUpDown,
  Package,
  FileInput,
  Warehouse,
  ScanLine,
  ShieldCheck,
  X,
  Send,
  Bell,
  ChevronDown,
  Printer,
} from "lucide-react";
import {
  CURRENCY_OPTIONS,
  TAX_TYPE_OPTIONS,
  appendPurchaseRequest,
  nextPurchaseRequestId,
  type PurchaseRequest,
} from "@/lib/purchase-requests";
import { cn } from "@/lib/utils";
import {
  formatNumberWithComma,
  parseNumberInput,
  parseNonNegNumber,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployeeSearchDialog } from "@/components/employees/employee-search-dialog";
import { WarehouseSearchDialog } from "@/components/warehouses/warehouse-search-dialog";
import { ItemSearchDialog } from "@/components/items/item-search-dialog";

export type LineRow = {
  id: string;
  checked: boolean;
  itemCode: string;
  itemName: string;
  spec: string;
  qty: string;
  unitPrice: string;
  supply: string;
  vat: string;
  extra: string;
  total: string;
};

type Master = {
  requestDate: string;
  slipNo: string;
  managerCode: string;
  managerName: string;
  taxType: string;
  warehouseCode: string;
  warehouseName: string;
  vendorCode: string;
  vendorName: string;
  currency: string;
  dueDate: string;
};

const INITIAL_LINE_COUNT = 3;

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyLine(): LineRow {
  return {
    id: `line-${Math.random().toString(36).slice(2, 9)}`,
    checked: false,
    itemCode: "",
    itemName: "",
    spec: "",
    qty: "",
    unitPrice: "",
    supply: "",
    vat: "",
    extra: "",
    total: "",
  };
}

function defaultMaster(): Master {
  const today = todayISO();
  return {
    requestDate: today,
    slipNo: "",
    managerCode: "",
    managerName: "",
    taxType: "과세",
    warehouseCode: "",
    warehouseName: "",
    vendorCode: "",
    vendorName: "",
    currency: "내자",
    dueDate: today,
  };
}

/** 과세 → 10% VAT */
function vatRate(taxType: string) {
  if (taxType === "과세") return 0.1;
  return 0;
}

function recalcLine(row: LineRow, taxType: string): LineRow {
  const qtyRaw = parseNumberInput(row.qty);
  const unitRaw = parseNumberInput(row.unitPrice);
  const qty = Number(qtyRaw);
  const unit = Number(unitRaw);
  if (
    Number.isNaN(qty) ||
    Number.isNaN(unit) ||
    qtyRaw === "" ||
    unitRaw === ""
  ) {
    return { ...row, supply: "", vat: "", total: "" };
  }
  const supply = Math.round(qty * unit);
  const vat = Math.round(supply * vatRate(taxType));
  const total = supply + vat;
  return {
    ...row,
    supply: String(supply),
    vat: String(vat),
    total: String(total),
  };
}

const LINE_TOOLBAR: { label: string; icon?: ReactNode }[] = [
  { label: "찾기", icon: <Search className="h-3 w-3" /> },
  { label: "정렬", icon: <ArrowUpDown className="h-3 w-3" /> },
  { label: "My품목", icon: <Package className="h-3 w-3" /> },
  { label: "소요" },
  { label: "주문" },
  { label: "전표불러오기", icon: <FileInput className="h-3 w-3" /> },
  { label: "재고불러오기", icon: <Warehouse className="h-3 w-3" /> },
  { label: "바코드", icon: <ScanLine className="h-3 w-3" /> },
  { label: "전표 바코드" },
  { label: "검증", icon: <ShieldCheck className="h-3 w-3" /> },
];

const fieldCls =
  "h-7 rounded border border-slate-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-indigo-500";
const labelCls =
  "flex h-7 min-w-[72px] shrink-0 items-center bg-slate-100 px-2 text-[11px] font-medium text-slate-600";

type Props = {
  mode?: "new" | "edit";
  editId?: string;
  /** page = standalone route; modal = dialog over list */
  variant?: "page" | "modal";
  onClose?: () => void;
  onSaved?: () => void;
};

function CodeNameField({
  label,
  code,
  name,
  onCodeChange,
  onNameChange,
  onSearch,
  codePlaceholder = "코드",
  namePlaceholder = "명칭",
}: {
  label: string;
  code: string;
  name: string;
  onCodeChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onSearch: () => void;
  codePlaceholder?: string;
  namePlaceholder?: string;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
      <span className={labelCls}>{label}</span>
      <Input
        className={cn(fieldCls, "w-[72px] shrink-0 rounded-none border-0 border-r border-slate-200")}
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder={codePlaceholder}
        aria-label={`${label} 코드`}
      />
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center border-r border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        onClick={onSearch}
        aria-label={`${label} 검색`}
      >
        <Search className="h-3 w-3" />
      </button>
      <Input
        className={cn(fieldCls, "min-w-0 flex-1 rounded-none border-0")}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={namePlaceholder}
        aria-label={`${label} 명칭`}
      />
    </div>
  );
}

function CommaLineInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (plain: string) => void;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : formatNumberWithComma(value);

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(parseNumberInput(e.target.value))}
    />
  );
}

export function PurchaseRequestForm({
  mode = "new",
  editId,
  variant = "page",
  onClose,
  onSaved,
}: Props) {
  const router = useRouter();
  const isModal = variant === "modal";
  const [master, setMaster] = useState<Master>(() => defaultMaster());
  const [lines, setLines] = useState<LineRow[]>(() =>
    Array.from({ length: INITIAL_LINE_COUNT }, () => emptyLine())
  );
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [warehouseSearchOpen, setWarehouseSearchOpen] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemSearchLineId, setItemSearchLineId] = useState<string | null>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  const totals = useMemo(() => {
    let qty = 0;
    let supply = 0;
    let vat = 0;
    let total = 0;
    for (const l of lines) {
      const qRaw = parseNumberInput(l.qty);
      const sRaw = parseNumberInput(l.supply);
      const vRaw = parseNumberInput(l.vat);
      const tRaw = parseNumberInput(l.total);
      const q = Number(qRaw);
      const s = Number(sRaw);
      const v = Number(vRaw);
      const t = Number(tRaw);
      if (!Number.isNaN(q) && qRaw !== "") qty += q;
      if (!Number.isNaN(s) && sRaw !== "") supply += s;
      if (!Number.isNaN(v) && vRaw !== "") vat += v;
      if (!Number.isNaN(t) && tRaw !== "") total += t;
    }
    return { qty, supply, vat, total };
  }, [lines]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (saveMenuRef.current && !saveMenuRef.current.contains(t)) setSaveMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F8") {
        e.preventDefault();
        handleSave(false);
      }
      if (e.key === "F7") {
        e.preventDefault();
        stub("저장/전표");
      }
      if (e.key === "F3") {
        e.preventDefault();
        stub("찾기");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [master, lines, mode, editId, isModal]);

  function stub(action: string) {
    alert(`${action} (데모)`);
  }

  function setMasterField<K extends keyof Master>(key: K, value: Master[K]) {
    setMaster((m) => {
      const next = { ...m, [key]: value };
      if (key === "taxType") {
        setLines((rows) => rows.map((r) => recalcLine(r, String(value))));
      }
      if (key === "requestDate" && (!m.dueDate || m.dueDate === m.requestDate)) {
        next.dueDate = String(value);
      }
      return next;
    });
  }

  function updateLine(id: string, patch: Partial<LineRow>) {
    setLines((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const merged = { ...r, ...patch };
        if ("qty" in patch || "unitPrice" in patch) {
          return recalcLine(merged, master.taxType);
        }
        return merged;
      })
    );
  }

  function addRow() {
    setLines((rows) => [...rows, emptyLine()]);
  }

  function removeChecked() {
    setLines((rows) => {
      const kept = rows.filter((r) => !r.checked);
      return kept.length >= 1 ? kept : [emptyLine()];
    });
  }

  function filledLines() {
    return lines.filter(
      (l) =>
        l.itemName.trim() ||
        l.itemCode.trim() ||
        (parseNumberInput(l.qty) !== "" && Number(parseNumberInput(l.qty)) > 0)
    );
  }

  function buildRowFromForm(): PurchaseRequest | null {
    const filled = filledLines();
    if (filled.length === 0) {
      alert("품목 행을 하나 이상 입력하세요.");
      return null;
    }
    const first = filled[0];
    const quantity = filled.reduce(
      (acc, l) => acc + parseNonNegNumber(l.qty),
      0
    );
    const amount = filled.reduce(
      (acc, l) =>
        acc + (parseNonNegNumber(l.total) || parseNonNegNumber(l.supply) || 0),
      0
    );
    return {
      id: mode === "edit" && editId ? editId : nextPurchaseRequestId(),
      requestDate: master.requestDate,
      vendor: master.vendorName.trim() || master.vendorCode.trim() || "(미지정)",
      item:
        filled.length === 1
          ? first.itemName.trim() || first.itemCode.trim() || "(미지정)"
          : `${first.itemName.trim() || first.itemCode.trim() || "품목"} 외 ${filled.length - 1}건`,
      dueDate: master.dueDate || master.requestDate,
      quantity,
      amount,
      status: "unconfirmed",
      manager: master.managerName || master.managerCode,
      taxType: master.taxType,
      warehouse: master.warehouseName || master.warehouseCode,
      project: undefined,
      currency: master.currency,
    };
  }

  function finishClose() {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/purchase-requests");
  }

  function handleSave(andSlip: boolean) {
    if (andSlip) {
      stub("저장/전표");
      return;
    }
    const row = buildRowFromForm();
    if (!row) return;
    appendPurchaseRequest(row);
    onSaved?.();
    if (isModal) {
      finishClose();
      return;
    }
    router.push("/purchase-requests");
  }

  function resetForm() {
    setMaster(defaultMaster());
    setLines(Array.from({ length: INITIAL_LINE_COUNT }, () => emptyLine()));
  }

  const title = mode === "edit" ? "발주요청입력 (수정)" : "발주요청입력";

  return (
    <div
      className={cn(
        "flex flex-col",
        isModal ? "h-full min-h-0" : "min-h-[calc(100vh-7rem)]"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {!isModal && (
            <p className="text-xs text-muted-foreground">
              발주요청 전표를 입력합니다. 저장 시 조회 목록에 반영됩니다. (클라이언트 목업)
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isModal && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={finishClose}
              aria-label="닫기"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Master header */}
        <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
            {/* 일자-No.: date picker + No. display */}
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>일자-No.</span>
              <Input
                type="date"
                className={cn(fieldCls, "min-w-[128px] rounded-none border-0 border-r border-slate-200")}
                value={master.requestDate}
                onChange={(e) => setMasterField("requestDate", e.target.value)}
              />
              <span className="flex h-7 shrink-0 items-center border-r border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-500">
                No.
              </span>
              <Input
                className={cn(
                  fieldCls,
                  "w-[88px] rounded-none border-0 bg-slate-50 text-slate-500"
                )}
                placeholder="자동"
                value={master.slipNo}
                readOnly
                onChange={(e) => setMasterField("slipNo", e.target.value)}
                aria-label="전표번호"
              />
            </div>

            <CodeNameField
              label="담당자"
              code={master.managerCode}
              name={master.managerName}
              onCodeChange={(v) => setMasterField("managerCode", v)}
              onNameChange={(v) => setMasterField("managerName", v)}
              onSearch={() => setEmployeeSearchOpen(true)}
              namePlaceholder="담당자명"
            />

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>거래유형</span>
              <select
                className={cn(fieldCls, "w-full rounded-none border-0 bg-white")}
                value={master.taxType}
                onChange={(e) => setMasterField("taxType", e.target.value)}
              >
                {TAX_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <CodeNameField
              label="창고"
              code={master.warehouseCode}
              name={master.warehouseName}
              onCodeChange={(v) => setMasterField("warehouseCode", v)}
              onNameChange={(v) => setMasterField("warehouseName", v)}
              onSearch={() => setWarehouseSearchOpen(true)}
              namePlaceholder="창고명"
            />

            <CodeNameField
              label="거래처"
              code={master.vendorCode}
              name={master.vendorName}
              onCodeChange={(v) => setMasterField("vendorCode", v)}
              onNameChange={(v) => setMasterField("vendorName", v)}
              onSearch={() => stub("거래처 검색")}
              namePlaceholder="거래처명"
            />

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>통화</span>
              <select
                className={cn(fieldCls, "w-full rounded-none border-0 bg-white")}
                value={master.currency}
                onChange={(e) => setMasterField("currency", e.target.value)}
              >
                {CURRENCY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>납기일자</span>
              <Input
                type="date"
                className={cn(fieldCls, "rounded-none border-0")}
                value={master.dueDate}
                onChange={(e) => setMasterField("dueDate", e.target.value)}
              />
            </div>

            {/* 첨부: wide click area */}
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>첨부</span>
              <button
                type="button"
                className="flex min-h-7 flex-1 items-center gap-2 bg-white px-3 text-left hover:bg-indigo-50/50"
                onClick={() => stub("첨부")}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-dashed border-slate-300 text-slate-400">
                  <Plus className="h-3 w-3" />
                </span>
                <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-400">
                  파일을 첨부하려면 클릭하세요
                </span>
              </button>
            </div>

            {/* Master placeholder: 새로운 항목 추가 */}
            <div className="flex items-stretch overflow-hidden rounded border border-dashed border-slate-200 md:col-span-2">
              <span className={cn(labelCls, "bg-slate-50 text-slate-400")}>새로운 항목 추가</span>
              <Input
                className={cn(
                  fieldCls,
                  "rounded-none border-0 bg-slate-50/80 text-slate-400 placeholder:text-slate-400"
                )}
                disabled
                placeholder="다양한 항목을 추가하여 활용할 수 있습니다."
                aria-label="새로운 항목 추가"
              />
            </div>
          </div>
        </div>

        {/* Line toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
          {LINE_TOOLBAR.map((t) => (
            <Button
              key={t.label}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-slate-200 px-2 text-[11px] text-slate-600"
              onClick={() => stub(t.label)}
            >
              {t.icon}
              {t.label}
            </Button>
          ))}
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={addRow}
            >
              <Plus className="h-3 w-3" />
              행추가
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-slate-500"
              onClick={removeChecked}
            >
              선택삭제
            </Button>
          </div>
        </div>

        {/* Line grid */}
        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          <table className="w-full min-w-[1020px] border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-indigo-50/80 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="w-8 px-2 py-1.5">
                  <span className="sr-only">선택</span>
                </th>
                <th className="w-8 px-1 py-1.5 text-center">+</th>
                <th className="min-w-[88px] px-2 py-1.5">품목코드</th>
                <th className="min-w-[140px] px-2 py-1.5">품목명</th>
                <th className="min-w-[80px] px-2 py-1.5">규격</th>
                <th className="min-w-[72px] px-2 py-1.5 text-right">수량</th>
                <th className="min-w-[88px] px-2 py-1.5 text-right">단가</th>
                <th className="min-w-[96px] px-2 py-1.5 text-right">공급가액</th>
                <th className="min-w-[80px] px-2 py-1.5 text-right">부가세</th>
                <th className="min-w-[100px] px-2 py-1.5 font-medium text-slate-400 normal-case">
                  새로운 항목 추가
                </th>
                <th className="min-w-[96px] px-2 py-1.5 text-right">합계</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={line.id}
                  className="border-b border-slate-100 hover:bg-indigo-50/30"
                >
                  <td className="px-2 py-0.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                      checked={line.checked}
                      onChange={(e) => updateLine(line.id, { checked: e.target.checked })}
                      aria-label={`행 ${idx + 1} 선택`}
                    />
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-indigo-600 hover:bg-indigo-100"
                      onClick={addRow}
                      aria-label="행 추가"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </td>
                  {(
                    [
                      ["itemCode", "left"],
                      ["itemName", "left"],
                      ["spec", "left"],
                      ["qty", "right"],
                      ["unitPrice", "right"],
                      ["supply", "right"],
                      ["vat", "right"],
                      ["extra", "left"],
                      ["total", "right"],
                    ] as const
                  ).map(([key, align]) => {
                    const readOnly = key === "supply" || key === "vat" || key === "total";
                    const isExtra = key === "extra";
                    const isMoney =
                      key === "unitPrice" ||
                      key === "supply" ||
                      key === "vat" ||
                      key === "total";
                    const isQty = key === "qty";
                    const useComma = isMoney || isQty;
                    const plain = line[key];
                    const displayValue =
                      useComma && readOnly
                        ? formatNumberWithComma(plain)
                        : plain;
                    return (
                      <td key={key} className="px-1 py-0.5">
                        {useComma && !readOnly ? (
                          <CommaLineInput
                            value={plain}
                            className={cn(
                              "h-7 rounded border-slate-200 px-1.5 text-[11px] focus-visible:ring-1 focus-visible:ring-indigo-500",
                              align === "right" && "text-right tabular-nums"
                            )}
                            onChange={(v) => updateLine(line.id, { [key]: v })}
                          />
                        ) : (
                          <Input
                            className={cn(
                              "h-7 rounded border-slate-200 px-1.5 text-[11px] focus-visible:ring-1 focus-visible:ring-indigo-500",
                              align === "right" && "text-right tabular-nums",
                              readOnly && "bg-slate-50 text-slate-600",
                              isExtra &&
                                "border-dashed border-slate-200 bg-slate-50/50 placeholder:text-slate-300"
                            )}
                            value={displayValue}
                            readOnly={readOnly}
                            placeholder={isExtra ? "" : undefined}
                            onChange={(e) =>
                              updateLine(line.id, { [key]: e.target.value })
                            }
                            onDoubleClick={() => {
                              if (key === "itemCode") {
                                setItemSearchLineId(line.id);
                                setItemSearchOpen(true);
                              }
                            }}
                            title={
                              key === "itemCode"
                                ? "더블클릭하여 품목 검색"
                                : undefined
                            }
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td colSpan={5} className="px-3 py-2 text-right text-[11px] text-slate-500">
                  합계
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {totals.qty ? totals.qty.toLocaleString("ko-KR") : ""}
                </td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-right tabular-nums">
                  {totals.supply ? totals.supply.toLocaleString("ko-KR") : ""}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {totals.vat ? totals.vat.toLocaleString("ko-KR") : ""}
                </td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-right tabular-nums text-indigo-700">
                  {totals.total ? totals.total.toLocaleString("ko-KR") : ""}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-500"
              onClick={() => stub("보내기")}
              aria-label="보내기"
              title="보내기"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-500"
              onClick={() => stub("알림")}
              aria-label="알림"
              title="알림"
            >
              <Bell className="h-3.5 w-3.5" />
            </Button>
            <p className="ml-1 text-[11px] text-muted-foreground">
              {mode === "edit" ? `수정 모드 · ${editId}` : "신규 입력"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative flex" ref={saveMenuRef}>
              <Button
                type="button"
                size="sm"
                className="h-8 min-w-[72px] rounded-r-none"
                onClick={() => handleSave(false)}
              >
                저장
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-l-none border-l border-indigo-400/40 px-1.5"
                onClick={() => setSaveMenuOpen((o) => !o)}
                aria-expanded={saveMenuOpen}
                aria-haspopup="menu"
                aria-label="저장 옵션"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              {saveMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full right-0 z-40 mb-1 min-w-[140px] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-1.5 text-left text-[11px] text-slate-700 hover:bg-indigo-50"
                    onClick={() => {
                      setSaveMenuOpen(false);
                      handleSave(false);
                    }}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] text-slate-700 hover:bg-indigo-50"
                    onClick={() => {
                      setSaveMenuOpen(false);
                      stub("저장 후 인쇄");
                    }}
                  >
                    <Printer className="h-3 w-3" />
                    저장 후 인쇄
                  </button>
                </div>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => handleSave(true)}
            >
              저장/전표
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={resetForm}>
              다시 작성
            </Button>
            {!isModal ? (
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={finishClose}>
                리스트
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={finishClose}
              >
                닫기
              </Button>
            )}
          </div>
        </div>
      </div>


      <EmployeeSearchDialog
        open={employeeSearchOpen}
        onOpenChange={setEmployeeSearchOpen}
        onSelect={(emp) => {
          setMaster((m) => ({ ...m, managerCode: emp.code, managerName: emp.name }));
        }}
      />

      <WarehouseSearchDialog
        open={warehouseSearchOpen}
        onOpenChange={setWarehouseSearchOpen}
        onSelect={(wh) => {
          setMaster((m) => ({ ...m, warehouseCode: wh.code, warehouseName: wh.name }));
        }}
      />

      <ItemSearchDialog
        open={itemSearchOpen}
        onOpenChange={(open) => {
          setItemSearchOpen(open);
          if (!open) setItemSearchLineId(null);
        }}
        onSelect={(item) => {
          if (!itemSearchLineId) return;
          updateLine(itemSearchLineId, {
            itemCode: item.code,
            itemName: item.name,
            ...(item.spec ? { spec: item.spec } : {}),
          });
          setItemSearchLineId(null);
        }}
      />

      <Label className="sr-only">발주요청입력 양식</Label>
    </div>
  );
}

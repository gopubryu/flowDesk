"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
} from "lucide-react";
import {
  CURRENCY_OPTIONS,
  TAX_TYPE_OPTIONS,
  appendPurchaseRequest,
  nextPurchaseRequestId,
  type PurchaseRequest,
} from "@/lib/purchase-requests";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LineRow = {
  id: string;
  checked: boolean;
  itemCode: string;
  itemName: string;
  vendorCode: string;
  vendorName: string;
  spec: string;
  qty: string;
  unitPrice: string;
  supply: string;
  vat: string;
  total: string;
};

type Master = {
  requestDate: string;
  slipNo: string;
  manager: string;
  taxType: string;
  warehouse: string;
  project: string;
  currency: string;
  dueDate: string;
};

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
    vendorCode: "",
    vendorName: "",
    spec: "",
    qty: "",
    unitPrice: "",
    supply: "",
    vat: "",
    total: "",
  };
}

function vatRate(taxType: string) {
  if (taxType === "과세") return 0.1;
  return 0;
}

function recalcLine(row: LineRow, taxType: string): LineRow {
  const qty = Number(row.qty);
  const unit = Number(row.unitPrice);
  if (Number.isNaN(qty) || Number.isNaN(unit) || row.qty === "" || row.unitPrice === "") {
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
  { label: "찾기(F3)", icon: <Search className="h-3 w-3" /> },
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
};

export function PurchaseRequestForm({ mode = "new", editId }: Props) {
  const router = useRouter();
  const [master, setMaster] = useState<Master>({
    requestDate: todayISO(),
    slipNo: "",
    manager: "",
    taxType: "부가세불적용",
    warehouse: "",
    project: "",
    currency: "내자",
    dueDate: "",
  });
  const [lines, setLines] = useState<LineRow[]>(() =>
    Array.from({ length: 8 }, () => emptyLine())
  );

  const totals = useMemo(() => {
    let qty = 0;
    let supply = 0;
    let vat = 0;
    let total = 0;
    for (const l of lines) {
      const q = Number(l.qty);
      const s = Number(l.supply);
      const v = Number(l.vat);
      const t = Number(l.total);
      if (!Number.isNaN(q) && l.qty !== "") qty += q;
      if (!Number.isNaN(s) && l.supply !== "") supply += s;
      if (!Number.isNaN(v) && l.vat !== "") vat += v;
      if (!Number.isNaN(t) && l.total !== "") total += t;
    }
    return { qty, supply, vat, total };
  }, [lines]);


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F8") {
        e.preventDefault();
        handleSave(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [master, lines, mode, editId]);

  function stub(action: string) {
    alert(`${action} (데모)`);
  }

  function setMasterField<K extends keyof Master>(key: K, value: Master[K]) {
    setMaster((m) => {
      const next = { ...m, [key]: value };
      if (key === "taxType") {
        setLines((rows) => rows.map((r) => recalcLine(r, String(value))));
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
        l.vendorName.trim() ||
        (l.qty !== "" && Number(l.qty) > 0)
    );
  }

  function buildRowFromForm(): PurchaseRequest | null {
    const filled = filledLines();
    if (filled.length === 0) {
      alert("품목 행을 하나 이상 입력하세요.");
      return null;
    }
    const first = filled[0];
    const quantity = filled.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
    const amount = filled.reduce((acc, l) => acc + (Number(l.total) || Number(l.supply) || 0), 0);
    return {
      id: mode === "edit" && editId ? editId : nextPurchaseRequestId(),
      requestDate: master.requestDate,
      vendor: first.vendorName.trim() || first.vendorCode.trim() || "(미지정)",
      item:
        filled.length === 1
          ? first.itemName.trim() || first.itemCode.trim() || "(미지정)"
          : `${first.itemName.trim() || first.itemCode.trim() || "품목"} 외 ${filled.length - 1}건`,
      dueDate: master.dueDate || master.requestDate,
      quantity,
      amount,
      status: "unconfirmed",
      manager: master.manager,
      taxType: master.taxType,
      warehouse: master.warehouse,
      project: master.project,
      currency: master.currency,
    };
  }

  function handleSave(andNew: boolean) {
    const row = buildRowFromForm();
    if (!row) return;
    appendPurchaseRequest(row);
    if (andNew) {
      resetForm();
      return;
    }
    router.push("/purchase-requests");
  }

  function resetForm() {
    setMaster({
      requestDate: todayISO(),
      slipNo: "",
      manager: "",
      taxType: "부가세불적용",
      warehouse: "",
      project: "",
      currency: "내자",
      dueDate: "",
    });
    setLines(Array.from({ length: 8 }, () => emptyLine()));
  }

  function close() {
    router.push("/purchase-requests");
  }

  const title = mode === "edit" ? "발주요청입력 (수정)" : "발주요청입력";

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="text-xs text-muted-foreground">
            발주요청 전표를 입력합니다. 저장 시 조회 목록에 반영됩니다. (클라이언트 목업)
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={close}>
          <X className="h-3.5 w-3.5" />
          닫기
        </Button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Master header — dense 2-col Ecount-like */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>일자-No.</span>
              <Input
                type="date"
                className={cn(fieldCls, "rounded-none border-0 border-r border-slate-200")}
                value={master.requestDate}
                onChange={(e) => setMasterField("requestDate", e.target.value)}
              />
              <Input
                className={cn(fieldCls, "w-24 rounded-none border-0")}
                placeholder="자동"
                value={master.slipNo}
                onChange={(e) => setMasterField("slipNo", e.target.value)}
              />
            </div>

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>담당자</span>
              <div className="relative flex-1">
                <Input
                  className={cn(fieldCls, "rounded-none border-0 pr-7")}
                  value={master.manager}
                  onChange={(e) => setMasterField("manager", e.target.value)}
                  placeholder="담당자 검색"
                />
                <Search className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

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

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>창고</span>
              <div className="relative flex-1">
                <Input
                  className={cn(fieldCls, "rounded-none border-0 pr-7")}
                  value={master.warehouse}
                  onChange={(e) => setMasterField("warehouse", e.target.value)}
                  placeholder="창고 검색"
                />
                <Search className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>프로젝트</span>
              <div className="relative flex-1">
                <Input
                  className={cn(fieldCls, "rounded-none border-0 pr-7")}
                  value={master.project}
                  onChange={(e) => setMasterField("project", e.target.value)}
                  placeholder="프로젝트 검색"
                />
                <Search className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

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

            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>첨부</span>
              <div className="flex flex-1 items-center gap-2 bg-white px-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={() => stub("첨부")}
                >
                  <Paperclip className="h-3 w-3" />
                  파일
                </Button>
                <span className="text-[11px] text-slate-400">첨부 없음</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
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
        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-indigo-50/80 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="w-8 px-2 py-1.5">
                  <span className="sr-only">선택</span>
                </th>
                <th className="w-8 px-1 py-1.5 text-center">+</th>
                <th className="min-w-[88px] px-2 py-1.5">품목코드</th>
                <th className="min-w-[140px] px-2 py-1.5">품목명</th>
                <th className="min-w-[88px] px-2 py-1.5">거래처코드</th>
                <th className="min-w-[120px] px-2 py-1.5">거래처명</th>
                <th className="min-w-[80px] px-2 py-1.5">규격</th>
                <th className="min-w-[72px] px-2 py-1.5 text-right">수량</th>
                <th className="min-w-[88px] px-2 py-1.5 text-right">단가</th>
                <th className="min-w-[96px] px-2 py-1.5 text-right">공급가액</th>
                <th className="min-w-[80px] px-2 py-1.5 text-right">부가세</th>
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
                      ["vendorCode", "left"],
                      ["vendorName", "left"],
                      ["spec", "left"],
                      ["qty", "right"],
                      ["unitPrice", "right"],
                      ["supply", "right"],
                      ["vat", "right"],
                      ["total", "right"],
                    ] as const
                  ).map(([key, align]) => {
                    const readOnly = key === "supply" || key === "vat" || key === "total";
                    return (
                      <td key={key} className="px-1 py-0.5">
                        <Input
                          className={cn(
                            "h-7 rounded border-slate-200 px-1.5 text-[11px] focus-visible:ring-1 focus-visible:ring-indigo-500",
                            align === "right" && "text-right tabular-nums",
                            readOnly && "bg-slate-50 text-slate-600"
                          )}
                          value={line[key]}
                          readOnly={readOnly}
                          onChange={(e) => updateLine(line.id, { [key]: e.target.value })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td colSpan={7} className="px-3 py-2 text-right text-[11px] text-slate-500">
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
                <td className="px-2 py-2 text-right tabular-nums text-indigo-700">
                  {totals.total ? totals.total.toLocaleString("ko-KR") : ""}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            {mode === "edit" ? `수정 모드 · ${editId}` : "신규 입력"} · F8 저장
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 min-w-[88px]"
              onClick={() => handleSave(false)}
            >
              저장(F8)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => handleSave(true)}
            >
              저장/신규
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => stub("저장/전표")}
            >
              저장/전표
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={resetForm}>
              다시 작성
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={close}>
              닫기
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-slate-500"
              onClick={() => stub("웹자료올리기")}
            >
              웹자료올리기
            </Button>
          </div>
        </div>
      </div>

      {/* visually hidden label helper for a11y balance */}
      <Label className="sr-only">발주요청입력 양식</Label>
    </div>
  );
}

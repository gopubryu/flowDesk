"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FilePlus2,
  MessageSquare,
  FileStack,
  Trash2,
  FileSpreadsheet,
  SlidersHorizontal,
  CheckCircle2,
  Search,
} from "lucide-react";
import {
  loadSalesPlans,
  saveSalesPlans,
  SALES_PLAN_STATUS_LABEL,
  SALES_PLAN_STATUS_TABS,
  type SalesPlan,
  type SalesPlanStatus,
} from "@/lib/sales-plans";
import { cn, formatKRW } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SalesPlanForm } from "@/components/sales-plans/sales-plan-form";

type TabKey = "all" | SalesPlanStatus;

const statusVariant: Record<
  SalesPlanStatus,
  "default" | "secondary" | "warning" | "success" | "danger"
> = {
  confirmed: "default",
  in_progress: "default",
  completed: "success",
};

export default function SalesPlansPage() {
  const [rows, setRows] = useState<SalesPlan[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-08-01");
  const [dateTo, setDateTo] = useState("2026-09-30");
  const [applied, setApplied] = useState({
    query: "",
    dateFrom: "2026-08-01",
    dateTo: "2026-09-30",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    setRows(loadSalesPlans());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSalesPlans(rows);
  }, [rows, hydrated]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        setNewOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function refreshFromStorage() {
    setRows(loadSalesPlans());
  }

  function closeNewModal() {
    setNewOpen(false);
    refreshFromStorage();
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (r.planDate < applied.dateFrom || r.planDate > applied.dateTo) return false;
      const q = applied.query.trim().toLowerCase();
      if (!q) return true;
      return (
        r.vendor.toLowerCase().includes(q) ||
        (r.vendorCode ?? "").toLowerCase().includes(q) ||
        r.item.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, tab, applied]);

  const tabCounts = useMemo(() => {
    const base = rows.filter(
      (r) => r.planDate >= applied.dateFrom && r.planDate <= applied.dateTo
    );
    const counts: Record<TabKey, number> = {
      all: base.length,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
    };
    for (const r of base) counts[r.status] += 1;
    return counts;
  }, [rows, applied]);

  const allChecked =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runSearch() {
    setApplied({ query, dateFrom, dateTo });
  }

  function stub(action: string) {
    alert(`${action} (데모)`);
  }

  function slipNo(id: string) {
    return id.replace(/^pp-/i, "");
  }

  function vendorCodeName(r: SalesPlan) {
    if (r.vendorCode) return `${r.vendorCode} ${r.vendor}`;
    return r.vendor;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            판매계획조회
          </h2>
          <p className="text-xs text-muted-foreground">
            판매계획 전표를 조회하고 진행상태를 관리합니다. (목업 데이터)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="pp-from" className="sr-only">
              시작일
            </Label>
            <Input
              id="pp-from"
              type="date"
              className="h-8 w-[138px] text-xs"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Label htmlFor="pp-to" className="sr-only">
              종료일
            </Label>
            <Input
              id="pp-to"
              type="date"
              className="h-8 w-[138px] text-xs"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-48 pl-8 text-xs"
              placeholder="거래처·품목 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
            />
          </div>
          <Button type="button" size="sm" className="h-8" onClick={runSearch}>
            조회
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-0">
        {SALES_PLAN_STATUS_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "relative -mb-px rounded-t-md px-3 py-2 text-xs font-medium transition-colors",
                active
                  ? "border border-b-background border-slate-200 bg-background text-indigo-700"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-[10px]",
                  active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                )}
              >
                {tabCounts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="전체 선택"
                    />
                  </th>
                  <th className="px-3 py-2.5">일자-No.</th>
                  <th className="px-3 py-2.5">거래처코드명</th>
                  <th className="px-3 py-2.5">품목명</th>
                  <th className="px-3 py-2.5 text-right">수량</th>
                  <th className="px-3 py-2.5 text-right">단가</th>
                  <th className="px-3 py-2.5 text-right">금액</th>
                  <th className="px-3 py-2.5 text-right">부가세</th>
                  <th className="px-3 py-2.5 text-right">합계</th>
                  <th className="px-3 py-2.5">최종수정자</th>
                  <th className="px-3 py-2.5">종결여부</th>
                  <th className="px-3 py-2.5">진행상태</th>
                </tr>
              </thead>
              <tbody>
                {!hydrated ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                      불러오는 중…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                      조회된 판매계획이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-indigo-50/40"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          aria-label={`${r.vendor} 선택`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {r.planDate}-{slipNo(r.id)}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {vendorCodeName(r)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{r.item}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                        {r.quantity.toLocaleString("ko-KR")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatKRW(r.unitPrice)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatKRW(r.amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatKRW(r.vat)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                        {formatKRW(r.total)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {r.lastModifier ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {r.closed ? "종결" : "미종결"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={statusVariant[r.status]}
                          className={cn(
                            "text-[10px] font-medium",
                            r.status === "confirmed" && "bg-indigo-100 text-indigo-800",
                            r.status === "in_progress" && "bg-sky-100 text-sky-800"
                          )}
                        >
                          {SALES_PLAN_STATUS_LABEL[r.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              {filtered.length}건 · 선택 {selected.size}건
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setNewOpen(true)}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                신규
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("수량조정")}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                수량조정
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("다른전표생성")}
              >
                <FileStack className="h-3.5 w-3.5" />
                다른전표생성
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("메신저")}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                메신저
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("종결")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                종결
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("선택삭제")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                선택삭제
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("Excel")}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={(open) => (open ? setNewOpen(true) : closeNewModal())}>
        <DialogContent
          className="pointer-events-auto flex h-[min(92vh,920px)] w-[min(96vw,1280px)] max-w-none flex-col overflow-hidden p-3 sm:p-4"
        >
          <SalesPlanForm
            mode="new"
            variant="modal"
            onClose={closeNewModal}
            onSaved={refreshFromStorage}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

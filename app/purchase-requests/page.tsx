"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FilePlus2,
  Mail,
  RefreshCw,
  Send,
  Printer,
  FileStack,
  Search,
} from "lucide-react";
import {
  loadPurchaseRequests,
  savePurchaseRequests,
  PURCHASE_REQUEST_STATUS_LABEL,
  PURCHASE_REQUEST_STATUS_TABS,
  type PurchaseRequest,
  type PurchaseRequestStatus,
} from "@/lib/purchase-requests";
import { cn, formatKRW } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PurchaseRequestForm } from "@/components/purchase-requests/purchase-request-form";

type TabKey = "all" | PurchaseRequestStatus;

const statusVariant: Record<
  PurchaseRequestStatus,
  "default" | "secondary" | "warning" | "success" | "danger"
> = {
  approval: "warning",
  unconfirmed: "secondary",
  confirmed: "default",
  in_progress: "default",
  completed: "success",
};

export default function PurchaseRequestsPage() {
  const [rows, setRows] = useState<PurchaseRequest[]>([]);
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
    const loaded = loadPurchaseRequests();
    setRows(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePurchaseRequests(rows);
  }, [rows, hydrated]);

  function refreshFromStorage() {
    setRows(loadPurchaseRequests());
  }

  function closeNewModal() {
    setNewOpen(false);
    refreshFromStorage();
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (r.requestDate < applied.dateFrom || r.requestDate > applied.dateTo) return false;
      const q = applied.query.trim().toLowerCase();
      if (!q) return true;
      return (
        r.vendor.toLowerCase().includes(q) ||
        r.item.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, tab, applied]);

  const tabCounts = useMemo(() => {
    const base = rows.filter(
      (r) => r.requestDate >= applied.dateFrom && r.requestDate <= applied.dateTo
    );
    const counts: Record<TabKey, number> = {
      all: base.length,
      approval: 0,
      unconfirmed: 0,
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
    setApplied({
      query,
      dateFrom,
      dateTo,
    });
  }

  function stub(action: string) {
    alert(`${action} (데모)`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            발주요청조회
          </h2>
          <p className="text-xs text-muted-foreground">
            발주요청 전표를 조회하고 진행상태를 관리합니다. (목업 데이터)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="pr-from" className="sr-only">
              시작일
            </Label>
            <Input
              id="pr-from"
              type="date"
              className="h-8 w-[138px] text-xs"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Label htmlFor="pr-to" className="sr-only">
              종료일
            </Label>
            <Input
              id="pr-to"
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
        {PURCHASE_REQUEST_STATUS_TABS.map((t) => {
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
            <table className="w-full min-w-[960px] border-collapse text-left text-xs">
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
                  <th className="px-3 py-2.5">발주요청일자</th>
                  <th className="px-3 py-2.5">거래처명</th>
                  <th className="px-3 py-2.5">품목</th>
                  <th className="px-3 py-2.5">납기일자</th>
                  <th className="px-3 py-2.5 text-right">수량</th>
                  <th className="px-3 py-2.5 text-right">금액</th>
                  <th className="px-3 py-2.5">진행상태</th>
                </tr>
              </thead>
              <tbody>
                {!hydrated ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                      불러오는 중…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                      조회된 발주요청이 없습니다.
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
                        {r.requestDate}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{r.vendor}</td>
                      <td className="px-3 py-2 text-slate-700">{r.item}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {r.dueDate}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                        {r.quantity.toLocaleString("ko-KR")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                        {formatKRW(r.amount)}
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
                          {PURCHASE_REQUEST_STATUS_LABEL[r.status]}
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
                onClick={() => stub("이메일")}
              >
                <Mail className="h-3.5 w-3.5" />
                이메일
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("진행상태변경")}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                진행상태변경
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("보내기")}
              >
                <Send className="h-3.5 w-3.5" />
                보내기
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => stub("인쇄")}
              >
                <Printer className="h-3.5 w-3.5" />
                인쇄
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ecount-style 신규 popup over the list */}
      <Dialog open={newOpen} onOpenChange={(open) => (open ? setNewOpen(true) : closeNewModal())}>
        <DialogContent
          className="pointer-events-auto flex h-[min(92vh,920px)] w-[min(96vw,1280px)] max-w-none flex-col overflow-hidden p-3 sm:p-4"
        >
          <PurchaseRequestForm
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

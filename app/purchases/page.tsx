"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FilePlus2,
  RefreshCw,
  Trash2,
  Search,
} from "lucide-react";
import {
  fetchPurchases,
  bulkDeletePurchasesApi,
  bulkUpdatePurchaseStatusApi,
  formatPurchaseDateNo,
  PURCHASE_STATUS_LABEL,
  PURCHASE_STATUS_TABS,
  INBOUND_STATUS_LABEL,
  TAX_TYPE_OPTIONS,
  SENT_FILTER_OPTIONS,
  SORT_OPTIONS,
  type Purchase,
  type PurchaseStatus,
  type InboundStatus,
} from "@/lib/purchases";
import Link from "next/link";
import { cn, formatKRW } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppAlertDialog, useAppDialog } from "@/components/ui/app-alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import { useWorkspaceRole } from "@/lib/use-workspace-role";

type TabKey = "all" | PurchaseStatus;
type DomesticFilter = "all" | "domestic" | "foreign";
type SentFilter = "all" | "sent" | "unsent";

const STATUS_OPTIONS: PurchaseStatus[] = [
  "approval",
  "unconfirmed",
  "confirmed",
];

const statusVariant: Record<
  PurchaseStatus,
  "default" | "secondary" | "warning" | "success" | "danger"
> = {
  approval: "warning",
  unconfirmed: "secondary",
  confirmed: "success",
};

const fieldCls =
  "h-7 rounded border border-slate-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-indigo-500";
const labelCls =
  "flex h-7 min-w-[88px] shrink-0 items-center bg-slate-100 px-2 text-[11px] font-medium text-slate-600";

export default function PurchasesPage() {
  const { alert: appAlert, confirm: appConfirm, dialog: appDialog } = useAppDialog();
  const { canWrite: allowWrite, canDelete: allowDelete } = useWorkspaceRole();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<PurchaseStatus>("unconfirmed");
  const [actionBusy, setActionBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [dateFrom, setDateFrom] = useState("2026-08-01");
  const [dateTo, setDateTo] = useState("2026-09-30");
  const [taxType, setTaxType] = useState("all");
  const [domestic, setDomestic] = useState<DomesticFilter>("all");
  const [warehouse, setWarehouse] = useState("");
  const [project, setProject] = useState("");
  const [vendor, setVendor] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [sent, setSent] = useState<SentFilter>("all");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>("일자");
  const [applied, setApplied] = useState({
    dateFrom: "2026-08-01",
    dateTo: "2026-09-30",
    taxType: "all",
    domestic: "all" as DomesticFilter,
    warehouse: "",
    project: "",
    vendor: "",
    itemCode: "",
    sent: "all" as SentFilter,
    sortBy: "일자" as (typeof SORT_OPTIONS)[number],
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);

  async function refreshFromApi() {
    const loaded = await fetchPurchases();
    setRows(loaded);
    try {
      localStorage.removeItem("flowdesk-purchases");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshFromApi();
      } catch (e) {
        console.error(e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function closeNewModal() {
    setNewOpen(false);
    void refreshFromApi();
  }

  function runSearch() {
    setSelected(new Set());
    setApplied({
      dateFrom,
      dateTo,
      taxType,
      domestic,
      warehouse,
      project,
      vendor,
      itemCode,
      sent,
      sortBy,
    });
  }

  async function openStatusChange() {
    if (selected.size === 0) {
      await appAlert({
        title: "알림",
        description: "진행상태를 변경할 항목을 선택해 주세요.",
      });
      return;
    }
    const first = rows.find((r) => selected.has(r.id));
    setNextStatus(first?.status ?? "unconfirmed");
    setStatusOpen(true);
  }

  async function applyStatusChange() {
    if (selected.size === 0) {
      await appAlert({
        title: "알림",
        description: "진행상태를 변경할 항목을 선택해 주세요.",
      });
      return;
    }
    setActionBusy(true);
    try {
      await bulkUpdatePurchaseStatusApi(Array.from(selected), nextStatus);
      setStatusOpen(false);
      setSelected(new Set());
      await refreshFromApi();
    } catch (err) {
      console.error(err);
      await appAlert({
        title: "알림",
        description:
          err instanceof Error ? err.message : "진행상태 변경에 실패했습니다.",
      });
    } finally {
      setActionBusy(false);
    }
  }

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (r.purchaseDate < applied.dateFrom || r.purchaseDate > applied.dateTo) return false;
      if (applied.taxType !== "all" && (r.taxType || "") !== applied.taxType) return false;
      if (applied.domestic === "domestic") {
        if (r.currency && r.currency !== "내자") return false;
      }
      if (applied.domestic === "foreign") {
        if (!r.currency || r.currency === "내자") return false;
      }
      if (applied.warehouse.trim()) {
        if (!(r.warehouse || "").toLowerCase().includes(applied.warehouse.trim().toLowerCase()))
          return false;
      }
      if (applied.project.trim()) {
        if (!(r.project || "").toLowerCase().includes(applied.project.trim().toLowerCase()))
          return false;
      }
      if (applied.vendor.trim()) {
        const q = applied.vendor.trim().toLowerCase();
        if (
          !r.vendor.toLowerCase().includes(q) &&
          !(r.vendorCode || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (applied.itemCode.trim()) {
        const q = applied.itemCode.trim().toLowerCase();
        if (!r.item.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false;
      }
      if (applied.sent === "sent" && !r.sent) return false;
      if (applied.sent === "unsent" && r.sent) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (applied.sortBy === "거래처") {
        const v = a.vendor.localeCompare(b.vendor, "ko");
        if (v !== 0) return v;
        return a.purchaseDate.localeCompare(b.purchaseDate);
      }
      if (applied.sortBy === "품목") {
        const v = a.item.localeCompare(b.item, "ko");
        if (v !== 0) return v;
        return a.purchaseDate.localeCompare(b.purchaseDate);
      }
      if (applied.sortBy === "금액") {
        return b.amount - a.amount;
      }
      const d = a.purchaseDate.localeCompare(b.purchaseDate);
      if (d !== 0) return d;
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [rows, tab, applied]);

  const tabCounts = useMemo(() => {
    const base = rows.filter(
      (r) => r.purchaseDate >= applied.dateFrom && r.purchaseDate <= applied.dateTo
    );
    const counts: Record<TabKey, number> = {
      all: base.length,
      approval: 0,
      unconfirmed: 0,
      confirmed: 0,
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

  async function deleteSelected() {
    if (selected.size === 0) {
      await appAlert({ title: "알림", description: "삭제할 항목을 선택하세요." });
      return;
    }
    const ok = await appConfirm({
      title: "삭제",
      description: `선택한 ${selected.size}건을 삭제할까요?`,
      confirmLabel: "삭제",
      confirmVariant: "danger",
    });
    if (!ok) return;
    setActionBusy(true);
    try {
      await bulkDeletePurchasesApi(Array.from(selected));
      setSelected(new Set());
      await refreshFromApi();
    } catch (err) {
      console.error(err);
      await appAlert({
        title: "알림",
        description: err instanceof Error ? err.message : "삭제에 실패했습니다.",
      });
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">구매조회</h2>
          <p className="text-xs text-muted-foreground">
            구매 전표를 조회하고 진행상태를 관리합니다.
          </p>
        </div>
      </div>

      {/* Filters — Ecount 구매조회 */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-2 p-3">
          <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>기준일자</span>
              <div className="flex flex-1 items-center gap-1 px-1">
                <Input
                  type="date"
                  className={cn(fieldCls, "w-full min-w-0 border-0 shadow-none")}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-[10px] text-slate-400">~</span>
                <Input
                  type="date"
                  className={cn(fieldCls, "w-full min-w-0 border-0 shadow-none")}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>거래유형</span>
              <select
                className={cn(fieldCls, "flex-1 rounded-none border-0")}
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
              >
                <option value="all">전체</option>
                {TAX_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>내.외자구분</span>
              <select
                className={cn(fieldCls, "flex-1 rounded-none border-0")}
                value={domestic}
                onChange={(e) => setDomestic(e.target.value as DomesticFilter)}
              >
                <option value="all">전체</option>
                <option value="domestic">내자</option>
                <option value="foreign">외자</option>
              </select>
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>창고</span>
              <Input
                className={cn(fieldCls, "flex-1 rounded-none border-0")}
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                placeholder="창고명"
              />
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>프로젝트</span>
              <Input
                className={cn(fieldCls, "flex-1 rounded-none border-0")}
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>거래처</span>
              <Input
                className={cn(fieldCls, "flex-1 rounded-none border-0")}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="거래처명/코드"
              />
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>품목코드</span>
              <Input
                className={cn(fieldCls, "flex-1 rounded-none border-0")}
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="품목명/코드"
              />
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>발송여부</span>
              <select
                className={cn(fieldCls, "flex-1 rounded-none border-0")}
                value={sent}
                onChange={(e) => setSent(e.target.value as SentFilter)}
              >
                {SENT_FILTER_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
              <span className={labelCls}>정렬</span>
              <select
                className={cn(fieldCls, "flex-1 rounded-none border-0")}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as (typeof SORT_OPTIONS)[number])}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" className="h-7 gap-1" onClick={runSearch}>
              <Search className="h-3.5 w-3.5" />
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-0">
        {PURCHASE_STATUS_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setSelected(new Set()); }}
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
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500">
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
                  <th className="px-3 py-2.5">거래처명</th>
                  <th className="px-3 py-2.5">품목명</th>
                  <th className="px-3 py-2.5 text-right">금액합계</th>
                  <th className="px-3 py-2.5 text-right">외화 금액</th>
                  <th className="px-3 py-2.5 text-right">원화 환산액</th>
                  <th className="px-3 py-2.5">거래유형명</th>
                  <th className="px-3 py-2.5">입고상태</th>
                  <th className="px-3 py-2.5">창고명</th>
                  <th className="px-3 py-2.5">입고</th>
                  <th className="px-3 py-2.5">회계반영여부</th>
                  <th className="px-3 py-2.5">인쇄</th>
                  <th className="px-3 py-2.5">불러온전표</th>
                </tr>
              </thead>
              <tbody>
                {!hydrated ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-10 text-center text-muted-foreground">
                      불러오는 중…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-10 text-center text-muted-foreground">
                      조회된 구매가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-indigo-50/40"
                      title={PURCHASE_STATUS_LABEL[r.status]}
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
                        {formatPurchaseDateNo(r.purchaseDate, r.slipNo)}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{r.vendor}</td>
                      <td className="px-3 py-2 text-slate-700">{r.item}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                        {formatKRW(r.amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                        {r.foreignAmount ? `${r.foreignAmount} ${r.currency === "JPY" ? "엔" : r.currency === "USD" ? "USD" : ""}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                        {r.baseAmount ? `${formatKRW(Number(r.baseAmount))}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{r.taxType || "—"}</td>
                                            <td className="px-3 py-2">
                        {r.status === "confirmed" ? (
                          <Badge
                            variant={
                              (r.inboundStatus || "none") === "complete"
                                ? "success"
                                : (r.inboundStatus || "none") === "partial"
                                  ? "warning"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {INBOUND_STATUS_LABEL[(r.inboundStatus || "none") as InboundStatus]}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{r.warehouse || "—"}</td>
                      <td className="px-3 py-2">
                        {r.status === "confirmed" ? ((r.inboundStatus || "none") !== "complete" ? (<Link href={`/inventory/receipts/new?purchaseId=${r.id}`} className="text-[11px] font-medium text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>입고하기</Link>) : (<span className="text-[11px] text-slate-400" title="이미 입고가 완료된 구매입니다.">입고 완료</span>)) : (<span className="text-[11px] text-slate-400" title="구매 확정 후 입고할 수 있습니다.">입고 대기 · 구매 확정 필요</span>)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {r.accountingReflect ? "반영" : "미반영"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{r.printed ? "Y" : "N"}</td>
                      <td className="px-3 py-2 text-slate-500">{r.importedSlip || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              {filtered.length}건 · 선택 {selected.size}건
              {tab !== "all" ? ` · ${PURCHASE_STATUS_LABEL[tab]}` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                disabled={!allowWrite}
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
                onClick={() => void openStatusChange()}
                disabled={actionBusy || !allowWrite}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                진행상태변경
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={!allowDelete}
                onClick={() => void deleteSelected()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                선택삭제
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={(open) => (open ? setNewOpen(true) : closeNewModal())}>
        <DialogContent className="pointer-events-auto flex h-[min(92vh,920px)] w-[min(96vw,1280px)] max-w-none flex-col overflow-hidden p-3 sm:p-4">
          <PurchaseForm
            mode="new"
            variant="modal"
            onClose={closeNewModal}
            onSaved={() => void refreshFromApi()}
          />
        </DialogContent>
      </Dialog>

      <AppAlertDialog
        open={statusOpen}
        onOpenChange={(open) => {
          if (!actionBusy) setStatusOpen(open);
        }}
        title="진행상태 변경"
        description={`선택한 ${selected.size}건의 진행상태를 변경합니다.`}
        confirmLabel={actionBusy ? "저장 중…" : "적용"}
        confirmDisabled={actionBusy}
        onConfirm={() => applyStatusChange()}
      >
        <Label htmlFor="pu-status-select" className="mb-1.5 block text-xs">
          새 진행상태
        </Label>
        <select
          id="pu-status-select"
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value as PurchaseStatus)}
          disabled={actionBusy}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {PURCHASE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </AppAlertDialog>

      <Label className="sr-only">구매조회</Label>
      {appDialog}
    </div>
  );
}

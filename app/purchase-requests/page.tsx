"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FilePlus2,
  Mail,
  RefreshCw,
  Printer,
  FileStack,
  Search,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  deletePurchaseRequestApi,
  fetchPurchaseRequests,
  PURCHASE_REQUEST_STATUS_LABEL,
  PURCHASE_REQUEST_STATUS_TABS,
  updatePurchaseRequestStatusApi,
  type PurchaseRequest,
  type PurchaseRequestStatus,
  formatCurrencyLabel,
} from "@/lib/purchase-requests";
import { cn, formatKRW } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { AppAlertDialog, useAppDialog } from "@/components/ui/app-alert-dialog";
import { PurchaseRequestForm } from "@/components/purchase-requests/purchase-request-form";

type TabKey = "all" | PurchaseRequestStatus;

const STATUS_OPTIONS: PurchaseRequestStatus[] = [
  "approval",
  "unconfirmed",
  "confirmed",
  "in_progress",
  "completed",
];

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

function headerText(v?: string | null) {
  const s = (v ?? "").trim();
  return s || "—";
}

function attachmentCount(r: PurchaseRequest) {
  return Array.isArray(r.attachments) ? r.attachments.length : 0;
}

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<PurchaseRequestStatus>("unconfirmed");
  const [actionBusy, setActionBusy] = useState(false);
  const { alert: appAlert, confirm: appConfirm, dialog: appDialog } = useAppDialog();

  async function refreshFromApi() {
    setLoading(true);
    setLoadError(null);
    try {
      const loaded = await fetchPurchaseRequests();
      setRows(loaded);
      try {
        localStorage.removeItem("flowdesk-purchase-requests");
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshFromApi();
  }, []);

  function closeNewModal() {
    setNewOpen(false);
    void refreshFromApi();
  }

  function openEdit(id: string) {
    router.push(`/purchase-requests/${id}/edit`);
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (r.requestDate < applied.dateFrom || r.requestDate > applied.dateTo) return false;
      const q = applied.query.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        r.vendor,
        r.item,
        r.id,
        r.manager,
        r.managerName,
        r.taxType,
        r.warehouse,
        r.warehouseName,
        r.currency,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
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
    setSelected(new Set());
    setApplied({
      query,
      dateFrom,
      dateTo,
    });
  }

  async function stub(action: string) {
    await appAlert({ title: "알림", description: `${action} (데모)` });
  }

  async function deleteSelected() {
    if (selected.size === 0) {
      await appAlert({ title: "알림", description: "삭제할 항목을 선택해 주세요." });
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
      const ids = Array.from(selected);
      for (const id of ids) {
        await deletePurchaseRequestApi(id);
      }
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
      const ids = Array.from(selected);
      for (const id of ids) {
        await updatePurchaseRequestStatusApi(id, nextStatus);
      }
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

  const colCount = 14;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            발주요청조회
          </h2>
          <p className="text-xs text-muted-foreground">
            발주요청 전표를 조회하고 진행상태를 관리합니다. 행을 클릭하면 수정 화면으로 이동합니다.
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
              placeholder="거래처·품목·담당자 검색"
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
              onClick={() => {
                setTab(t.key);
                setSelected(new Set());
              }}
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
            <table className="w-full min-w-[1280px] border-collapse text-left text-xs">
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
                  <th className="px-3 py-2.5">담당자</th>
                  <th className="px-3 py-2.5">거래유형</th>
                  <th className="px-3 py-2.5">창고</th>
                  <th className="px-3 py-2.5">통화</th>
                  <th className="px-3 py-2.5">품목</th>
                  <th className="px-3 py-2.5">납기일자</th>
                  <th className="px-3 py-2.5 text-right">수량</th>
                  <th className="px-3 py-2.5 text-right">금액</th>
                  <th className="px-3 py-2.5 text-center">첨부</th>
                  <th className="px-3 py-2.5">진행상태</th>
                  <th className="px-3 py-2.5 text-center">수정</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-10 text-center text-muted-foreground">
                      불러오는 중…
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-10 text-center text-rose-600">
                      {loadError}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-10 text-center text-muted-foreground">
                      조회된 발주요청이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const attN = attachmentCount(r);
                    return (
                      <tr
                        key={r.id}
                        className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/40"
                        onClick={() => openEdit(r.id)}
                      >
                        <td
                          className="px-3 py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {headerText(r.managerName ?? r.manager)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {headerText(r.taxType)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {headerText(r.warehouseName ?? r.warehouse)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {formatCurrencyLabel(headerText(r.currency))}
                        </td>
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
                        <td className="px-3 py-2 text-center text-slate-700">
                          {attN > 0 ? (
                            <span
                              className="inline-flex items-center justify-center gap-1 text-indigo-700"
                              title={`첨부 ${attN}건`}
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              <span className="tabular-nums">{attN}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
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
                        <td
                          className="px-3 py-2 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                            onClick={() => openEdit(r.id)}
                          >
                            <Pencil className="h-3 w-3" />
                            수정
                          </Button>
                        </td>
                      </tr>
                    );
                  })
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
                disabled={actionBusy}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                신규
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => void stub("이메일")}
                disabled={actionBusy}
              >
                <Mail className="h-3.5 w-3.5" />
                이메일
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => void openStatusChange()}
                disabled={actionBusy}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                진행상태변경
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                onClick={() => void deleteSelected()}
                disabled={actionBusy}
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => void stub("인쇄")}
                disabled={actionBusy}
              >
                <Printer className="h-3.5 w-3.5" />
                인쇄
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => void stub("다른전표생성")}
                disabled={actionBusy}
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
        <Label htmlFor="pr-status-select" className="mb-1.5 block text-xs">
          새 진행상태
        </Label>
        <select
          id="pr-status-select"
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value as PurchaseRequestStatus)}
          disabled={actionBusy}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {PURCHASE_REQUEST_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </AppAlertDialog>

      {appDialog}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileSpreadsheet, Printer, Search, Settings2 } from "lucide-react";
import {
  SALES_PLAN_STATUS_LABEL,
  countBySalesPlanStatus,
  defaultSalesPlanDateRange,
  loadSalesPlans,
  summarizeSalesPlans,
  type SalesPlan,
  type SalesPlanStatus,
} from "@/lib/sales-plans";
import { cn, formatKRW } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ViewMode = "status" | "aggregate";
type DomesticFilter = "all" | "domestic" | "foreign";
type ComparePeriod = "none" | "yoy" | "prev_month" | "prev_week" | "prev_day";

const COMPARE_OPTIONS: { key: ComparePeriod; label: string }[] = [
  { key: "none", label: "사용안함" },
  { key: "yoy", label: "전년동일기간" },
  { key: "prev_month", label: "전월" },
  { key: "prev_week", label: "전주" },
  { key: "prev_day", label: "전일" },
];

const AGG_DIMS = [
  "일별",
  "주차별",
  "월별",
  "담당자별",
  "창고별",
  "거래유형별",
  "거래처별",
  "품목별",
] as const;

const chartColors: Record<SalesPlanStatus, string> = {
  confirmed: "#6366f1",
  in_progress: "#0ea5e9",
  completed: "#22c55e",
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}년 ${Number(m)}월 소계`;
}

type ResultRow =
  | {
      kind: "data";
      id: string;
      planDate: string;
      slipNo: string;
      item: string;
      quantity: number;
      unitPrice: number;
      supply: number;
      vat: number;
      total: number;
      vendor: string;
      status: SalesPlanStatus;
    }
  | {
      kind: "subtotal";
      key: string;
      label: string;
      quantity: number;
      supply: number;
      total: number;
      count: number;
    }
  | {
      kind: "total";
      quantity: number;
      supply: number;
      total: number;
      count: number;
    };

export default function SalesPlanStatusPage() {
  const defaults = useMemo(() => defaultSalesPlanDateRange(), []);
  const [rows, setRows] = useState<SalesPlan[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("status");
  const [showChart, setShowChart] = useState(false);

  const [lineMode] = useState("라인별");
  const [compare, setCompare] = useState<ComparePeriod>("none");
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [slipNo, setSlipNo] = useState("");
  const [domestic, setDomestic] = useState<DomesticFilter>("all");
  const [warehouse, setWarehouse] = useState("");
  const [project, setProject] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [sortBy, setSortBy] = useState("일자");

  const [agg1, setAgg1] = useState<(typeof AGG_DIMS)[number]>("월별");
  const [agg2, setAgg2] = useState<(typeof AGG_DIMS)[number] | "">("거래처별");

  const [applied, setApplied] = useState({
    dateFrom: defaults.from,
    dateTo: defaults.to,
    dueFrom: "",
    dueTo: "",
    slipNo: "",
    domestic: "all" as DomesticFilter,
    warehouse: "",
    project: "",
    vendorCode: "",
    itemCode: "",
    sortBy: "일자",
  });

  useEffect(() => {
    setRows(loadSalesPlans());
    setHydrated(true);
  }, []);

  function applyFilters() {
    setApplied({
      dateFrom,
      dateTo,
      dueFrom,
      dueTo,
      slipNo,
      domestic,
      warehouse,
      project,
      vendorCode,
      itemCode,
      sortBy,
    });
  }

  function stub(action: string) {
    alert(`${action} (데모)`);
  }

  function setRange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    setApplied((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
  }

  function shortcut(kind: string) {
    const today = new Date();
    const t = isoDate(today);
    if (kind === "today") {
      setRange(t, t);
      return;
    }
    if (kind === "yesterday") {
      const y = isoDate(addDays(today, -1));
      setRange(y, y);
      return;
    }
    if (kind === "this_week") {
      const s = startOfWeek(today);
      setRange(isoDate(s), t);
      return;
    }
    if (kind === "last_week") {
      const s = startOfWeek(today);
      const prevEnd = addDays(s, -1);
      const prevStart = addDays(prevEnd, -6);
      setRange(isoDate(prevStart), isoDate(prevEnd));
      return;
    }
    if (kind === "this_month") {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      setRange(isoDate(s), t);
      return;
    }
    if (kind === "last_month") {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      setRange(isoDate(s), isoDate(e));
      return;
    }
    if (kind === "end_only") {
      setDateTo(t);
      setApplied((prev) => ({ ...prev, dateTo: t }));
      return;
    }
    if (kind === "reset") {
      const d = defaultSalesPlanDateRange();
      setDateFrom(d.from);
      setDateTo(d.to);
      setDueFrom("");
      setDueTo("");
      setSlipNo("");
      setDomestic("all");
      setWarehouse("");
      setProject("");
      setVendorCode("");
      setItemCode("");
      setSortBy("일자");
      setCompare("none");
      setShowChart(false);
      setApplied({
        dateFrom: d.from,
        dateTo: d.to,
        dueFrom: "",
        dueTo: "",
        slipNo: "",
        domestic: "all",
        warehouse: "",
        project: "",
        vendorCode: "",
        itemCode: "",
        sortBy: "일자",
      });
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F8") {
        e.preventDefault();
        applyFilters();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, dueFrom, dueTo, slipNo, domestic, warehouse, project, vendorCode, itemCode, sortBy]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      if (r.planDate < applied.dateFrom || r.planDate > applied.dateTo) return false;
      if (applied.dueFrom && (r.dueDate ?? "") < applied.dueFrom) return false;
      if (applied.dueTo && (r.dueDate ?? "") > applied.dueTo) return false;
      if (applied.slipNo.trim()) {
        const q = applied.slipNo.trim().toLowerCase();
        if (!r.id.toLowerCase().includes(q)) return false;
      }
      if (applied.vendorCode.trim()) {
        const q = applied.vendorCode.trim().toLowerCase();
        if (
          !r.vendor.toLowerCase().includes(q) &&
          !(r.vendorCode ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (applied.itemCode.trim()) {
        const q = applied.itemCode.trim().toLowerCase();
        if (!r.item.toLowerCase().includes(q)) return false;
      }
      if (applied.warehouse.trim() && r.warehouse) {
        if (!r.warehouse.toLowerCase().includes(applied.warehouse.trim().toLowerCase()))
          return false;
      } else if (applied.warehouse.trim() && !r.warehouse) {
        return false;
      }
      if (applied.project.trim() && r.project) {
        if (!r.project.toLowerCase().includes(applied.project.trim().toLowerCase())) return false;
      } else if (applied.project.trim() && !r.project) {
        return false;
      }
      if (applied.domestic === "domestic") {
        if (r.currency && r.currency !== "내자") return false;
      }
      if (applied.domestic === "foreign") {
        if (!r.currency || r.currency === "내자") return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (applied.sortBy === "거래처") {
        const v = a.vendor.localeCompare(b.vendor, "ko");
        if (v !== 0) return v;
        return a.planDate.localeCompare(b.planDate);
      }
      if (applied.sortBy === "품목") {
        const v = a.item.localeCompare(b.item, "ko");
        if (v !== 0) return v;
        return a.planDate.localeCompare(b.planDate);
      }
      const d = a.planDate.localeCompare(b.planDate);
      if (d !== 0) return d;
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [rows, applied]);

  const summary = useMemo(() => summarizeSalesPlans(filtered), [filtered]);

  const resultRows: ResultRow[] = useMemo(() => {
    const out: ResultRow[] = [];
    let curMonth = "";
    let mQty = 0;
    let mSupply = 0;
    let mTotal = 0;
    let mCount = 0;
    let tQty = 0;
    let tSupply = 0;
    let tTotal = 0;

    const flush = () => {
      if (!curMonth) return;
      out.push({
        kind: "subtotal",
        key: curMonth,
        label: monthLabel(curMonth),
        quantity: mQty,
        supply: mSupply,
        total: mTotal,
        count: mCount,
      });
    };

    for (const r of filtered) {
      const mk = monthKey(r.planDate);
      if (curMonth && mk !== curMonth) {
        flush();
        mQty = 0;
        mSupply = 0;
        mTotal = 0;
        mCount = 0;
      }
      curMonth = mk;
      out.push({
        kind: "data",
        id: r.id,
        planDate: r.planDate,
        slipNo: r.id.replace(/^pp-/i, ""),
        item: r.item,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        supply: r.amount,
        vat: r.vat,
        total: r.total,
        vendor: r.vendor,
        status: r.status,
      });
      mQty += r.quantity;
      mSupply += r.amount;
      mTotal += r.total;
      mCount += 1;
      tQty += r.quantity;
      tSupply += r.amount;
      tTotal += r.total;
    }
    flush();
    if (filtered.length > 0) {
      out.push({
        kind: "total",
        quantity: tQty,
        supply: tSupply,
        total: tTotal,
        count: filtered.length,
      });
    }
    return out;
  }, [filtered]);

  const chartData = useMemo(() => {
    return countBySalesPlanStatus(filtered)
      .filter((c) => c.status !== "all")
      .map((c) => ({
        name: c.label,
        count: c.count,
        fill: chartColors[c.status as SalesPlanStatus],
      }));
  }, [filtered]);

  const fieldCls =
    "h-7 rounded border border-slate-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-indigo-500";
  const labelCls =
    "flex h-7 min-w-[88px] shrink-0 items-center bg-slate-100 px-2 text-[11px] font-medium text-slate-600";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-t-md border border-b-0 border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700"
          >
            기본
          </button>
          <button
            type="button"
            className="rounded-t-md border border-transparent px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-100"
            onClick={() => stub("탭 추가")}
          >
            +
          </button>
        </div>
        <div className="flex rounded-md border border-slate-200 p-0.5">
          {(
            [
              { key: "status", label: "현황" },
              { key: "aggregate", label: "집계" },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setViewMode(m.key)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                viewMode === m.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900">판매계획현황</h2>
        <p className="text-xs text-muted-foreground">
          Ecount형 현황·집계 조회 (목업 · localStorage 연동)
        </p>
      </div>

      {viewMode === "status" ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-2 p-3">
            <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
              <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
                <span className={labelCls}>구분</span>
                <Input className={cn(fieldCls, "flex-1 rounded-none border-0")} value={lineMode} readOnly />
              </div>
              <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
                <span className={labelCls}>비교기간</span>
                <select
                  className={cn(fieldCls, "flex-1 rounded-none border-0")}
                  value={compare}
                  onChange={(e) => setCompare(e.target.value as ComparePeriod)}
                >
                  {COMPARE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
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
                <span className={labelCls}>판매계획No</span>
                <Input
                  className={cn(fieldCls, "flex-1 rounded-none border-0")}
                  value={slipNo}
                  onChange={(e) => setSlipNo(e.target.value)}
                  placeholder="번호 검색"
                />
              </div>
              <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
                <span className={labelCls}>내·외자구분</span>
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
                <span className={labelCls}>납기일자</span>
                <div className="flex flex-1 items-center gap-1 px-1">
                  <Input
                    type="date"
                    className={cn(fieldCls, "w-full min-w-0 border-0 shadow-none")}
                    value={dueFrom}
                    onChange={(e) => setDueFrom(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400">~</span>
                  <Input
                    type="date"
                    className={cn(fieldCls, "w-full min-w-0 border-0 shadow-none")}
                    value={dueTo}
                    onChange={(e) => setDueTo(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
                <span className={labelCls}>창고</span>
                <Input
                  className={cn(fieldCls, "flex-1 rounded-none border-0")}
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
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
                <span className={labelCls}>거래처코드</span>
                <Input
                  className={cn(fieldCls, "flex-1 rounded-none border-0")}
                  value={vendorCode}
                  onChange={(e) => setVendorCode(e.target.value)}
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
                <span className={labelCls}>정렬기준</span>
                <select
                  className={cn(fieldCls, "flex-1 rounded-none border-0")}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="일자">일자</option>
                  <option value="거래처">거래처</option>
                  <option value="품목">품목</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                  checked={showChart}
                  onChange={(e) => setShowChart(e.target.checked)}
                />
                그래프로 보기
              </label>
              <Button type="button" size="sm" className="h-7 gap-1" onClick={applyFilters}>
                <Search className="h-3.5 w-3.5" />
                검색
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-3 p-3">
            <p className="text-xs text-muted-foreground">
              집계 조건 1·2는 필수입니다. (집계 결과 엔진은 데모 스텁)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
                <span className={labelCls}>집계조건1 *</span>
                <select
                  className={cn(fieldCls, "flex-1 rounded-none border-0")}
                  value={agg1}
                  onChange={(e) => setAgg1(e.target.value as (typeof AGG_DIMS)[number])}
                >
                  {AGG_DIMS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-stretch overflow-hidden rounded border border-slate-200">
                <span className={labelCls}>집계조건2 *</span>
                <select
                  className={cn(fieldCls, "flex-1 rounded-none border-0")}
                  value={agg2}
                  onChange={(e) => setAgg2(e.target.value as (typeof AGG_DIMS)[number])}
                >
                  {AGG_DIMS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
              집계 미리보기 — {agg1} × {agg2 || "(미선택)"} · 검색 시 현황 데이터 기준으로 요약합니다.
              <div className="mt-2">
                <Button type="button" size="sm" className="h-7" onClick={applyFilters}>
                  검색
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["search", "검색"],
            ["today", "금일"],
            ["yesterday", "전일"],
            ["this_week", "금주"],
            ["last_week", "전주"],
            ["this_month", "금월"],
            ["last_month", "전월"],
            ["end_only", "종료일"],
            ["settings", "설정"],
            ["reset", "다시작성"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              if (key === "search") applyFilters();
              else if (key === "settings") stub("설정");
              else shortcut(key);
            }}
          >
            {key === "settings" ? (
              <span className="inline-flex items-center gap-1">
                <Settings2 className="h-3 w-3" />
                {label}
              </span>
            ) : (
              label
            )}
          </Button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "건수", value: `${summary.count.toLocaleString("ko-KR")}건` },
          { label: "총수량", value: summary.quantitySum.toLocaleString("ko-KR") },
          { label: "총금액", value: formatKRW(summary.amountSum) },
          {
            label: "진행중 건수",
            value: `${summary.inProgressCount.toLocaleString("ko-KR")}건`,
          },
        ].map((s) => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center justify-between gap-2 p-2.5">
              <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showChart && viewMode === "status" && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              진행상태별 건수
            </p>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(99,102,241,0.06)" }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Bar dataKey="count" name="건수" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[960px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">일자-No.</th>
                  <th className="px-3 py-2.5">품목명(규격)</th>
                  <th className="px-3 py-2.5 text-right">수량</th>
                  <th className="px-3 py-2.5 text-right">단가</th>
                  <th className="px-3 py-2.5 text-right">공급가액</th>
                  <th className="px-3 py-2.5 text-right">합계</th>
                  <th className="px-3 py-2.5">거래처명</th>
                </tr>
              </thead>
              <tbody>
                {!hydrated ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      불러오는 중…
                    </td>
                  </tr>
                ) : resultRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                      조회된 판매계획현황이 없습니다.
                    </td>
                  </tr>
                ) : (
                  resultRows.map((r, idx) => {
                    if (r.kind === "subtotal") {
                      return (
                        <tr key={`sub-${r.key}`} className="border-b bg-indigo-50/50">
                          <td
                            colSpan={2}
                            className="px-3 py-2 text-[11px] font-semibold text-indigo-800"
                          >
                            {r.label} ({r.count}건)
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-900">
                            {r.quantity.toLocaleString("ko-KR")}
                          </td>
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-900">
                            {formatKRW(r.supply)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-900">
                            {formatKRW(r.total)}
                          </td>
                          <td />
                        </tr>
                      );
                    }
                    if (r.kind === "total") {
                      return (
                        <tr key="total" className="border-b bg-slate-100">
                          <td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-slate-900">
                            총합계 ({r.count}건)
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">
                            {r.quantity.toLocaleString("ko-KR")}
                          </td>
                          <td className="px-3 py-2.5" />
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">
                            {formatKRW(r.supply)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">
                            {formatKRW(r.total)}
                          </td>
                          <td />
                        </tr>
                      );
                    }
                    return (
                      <tr
                        key={`${r.id}-${idx}`}
                        className="border-b border-slate-100 hover:bg-indigo-50/40"
                        title={SALES_PLAN_STATUS_LABEL[r.status]}
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                          {r.planDate}-{r.slipNo}
                        </td>
                        <td className="px-3 py-2 text-slate-800">{r.item}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                          {r.quantity.toLocaleString("ko-KR")}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                          {formatKRW(r.unitPrice)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                          {formatKRW(r.supply)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                          {formatKRW(r.total)}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">{r.vendor}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              {viewMode === "status" ? "현황" : "집계"} · {filtered.length}건
              {compare !== "none"
                ? ` · 비교기간: ${COMPARE_OPTIONS.find((c) => c.key === compare)?.label}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
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
                onClick={() => stub("Excel(화면)")}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel(화면)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

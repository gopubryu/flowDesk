"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { defaultQuotationDateRange, fetchQuotations, QUOTATION_STATUS_LABEL, type Quotation, type QuotationStatus } from "@/lib/quotations";

type StatusTone = "default" | "secondary" | "success" | "warning" | "danger";
const STATUS_TONE: Record<QuotationStatus, StatusTone> = { draft: "secondary", sent: "default", accepted: "success", rejected: "danger", expired: "warning" };
const STATUS_ORDER: QuotationStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];

export function QuotationStatusDashboard() {
  const defaults = defaultQuotationDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [rows, setRows] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try { setRows(await fetchQuotations({ from, to })); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "현황을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => STATUS_ORDER.map((status) => ({ status, count: rows.filter((row) => row.status === status).length, total: rows.filter((row) => row.status === status).reduce((sum, row) => sum + row.total, 0) })), [rows]);
  const expiring = useMemo(() => { const end = new Date(); end.setDate(end.getDate() + 7); const now = new Date().toISOString().slice(0, 10); const last = end.toISOString().slice(0, 10); return rows.filter((row) => row.status !== "accepted" && row.status !== "rejected" && row.validUntil && row.validUntil >= now && row.validUntil <= last); }, [rows]);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const converted = rows.filter((row) => row.convertedSalesPlanId).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-base font-semibold tracking-tight text-slate-900">견적서현황</h2><p className="text-xs text-muted-foreground">기간별 견적 상태와 판매계획 전환 현황을 확인합니다.</p></div>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void load()} disabled={loading}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />새로고침</Button>
      </div>

      <Card className="border-slate-200 shadow-sm"><CardContent className="p-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><div className="flex items-stretch overflow-hidden rounded border border-slate-200"><span className="flex h-7 min-w-[72px] items-center bg-slate-100 px-2 text-[11px] font-medium text-slate-600">기준일자</span><Input type="date" className="h-7 flex-1 rounded-none border-0 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} /><span className="flex h-7 items-center text-[10px] text-slate-400">~</span><Input type="date" className="h-7 flex-1 rounded-none border-0 text-xs" value={to} onChange={(e) => setTo(e.target.value)} /></div><Button type="button" size="sm" className="h-7 w-fit gap-1" onClick={() => void load()}><Search className="h-3.5 w-3.5" />검색</Button></div></CardContent></Card>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Card className="border-slate-200 shadow-sm"><CardContent className="p-3"><p className="text-[11px] font-medium text-slate-500">전체 견적</p><p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{rows.length.toLocaleString("ko-KR")}건</p><p className="text-xs tabular-nums text-slate-500">{total.toLocaleString("ko-KR")}원</p></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardContent className="p-3"><p className="text-[11px] font-medium text-slate-500">수락 견적</p><p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">{(summary.find((row) => row.status === "accepted")?.count ?? 0).toLocaleString("ko-KR")}건</p><p className="text-xs tabular-nums text-slate-500">{(summary.find((row) => row.status === "accepted")?.total ?? 0).toLocaleString("ko-KR")}원</p></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardContent className="p-3"><p className="text-[11px] font-medium text-slate-500">판매계획 전환</p><p className="mt-1 text-lg font-semibold tabular-nums text-indigo-700">{converted.toLocaleString("ko-KR")}건</p><p className="text-xs text-slate-500">수락 견적 기준</p></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardContent className="p-3"><p className="text-[11px] font-medium text-slate-500">7일 이내 만료 예정</p><p className="mt-1 text-lg font-semibold tabular-nums text-amber-700">{expiring.length.toLocaleString("ko-KR")}건</p><p className="text-xs text-slate-500">미수락 견적</p></CardContent></Card></div>

      <Card className="border-slate-200 shadow-sm"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead><tr className="border-b bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500"><th className="px-3 py-2.5">상태</th><th className="px-3 py-2.5 text-right">건수</th><th className="px-3 py-2.5 text-right">합계금액</th><th className="px-3 py-2.5">비율</th></tr></thead><tbody>{summary.map((row) => <tr key={row.status} className="border-b border-slate-100"><td className="px-3 py-2"><Badge variant={STATUS_TONE[row.status]} className="text-[10px]">{QUOTATION_STATUS_LABEL[row.status]}</Badge></td><td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.count.toLocaleString("ko-KR")}건</td><td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{row.total.toLocaleString("ko-KR")}원</td><td className="px-3 py-2 text-slate-500">{rows.length ? Math.round((row.count / rows.length) * 100) : 0}%</td></tr>)}</tbody></table></div></CardContent></Card>

      <div className="grid gap-3 lg:grid-cols-2"><Card className="border-slate-200 shadow-sm"><CardContent className="p-3"><div className="mb-2 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-amber-600" /><h3 className="text-xs font-semibold text-slate-800">7일 이내 만료 예정 미수락 견적</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[420px] text-xs"><thead><tr className="border-b bg-slate-50 text-[10px] text-slate-500"><th className="px-2 py-2 text-left">견적번호</th><th className="px-2 py-2 text-left">거래처</th><th className="px-2 py-2 text-right">유효기간</th></tr></thead><tbody>{loading ? <tr><td colSpan={3} className="px-2 py-5 text-center text-muted-foreground">불러오는 중…</td></tr> : expiring.length ? expiring.map((row) => <tr className="border-b border-slate-100" key={row.id}><td className="px-2 py-2 font-medium text-slate-700">{row.slipNo}</td><td className="px-2 py-2 text-slate-700">{row.vendorName}</td><td className="px-2 py-2 text-right tabular-nums text-amber-700">{row.validUntil}</td></tr>) : <tr><td colSpan={3} className="px-2 py-5 text-center text-muted-foreground">해당 견적이 없습니다.</td></tr>}</tbody></table></div></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardContent className="p-3"><h3 className="text-xs font-semibold text-slate-800">판매계획 전환 완료</h3><p className="mt-2 text-3xl font-semibold tabular-nums text-indigo-700">{converted.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-normal text-slate-500">건</span></p><p className="mt-1 text-xs text-slate-500">수락된 견적 중 판매계획으로 전환된 건수입니다.</p></CardContent></Card></div>
    </div>
  );
}

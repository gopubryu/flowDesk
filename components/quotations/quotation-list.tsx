"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, FilePlus2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatKRW } from "@/lib/utils";
import { convertQuotation, defaultQuotationDateRange, deleteQuotation, fetchQuotations, QUOTATION_STATUS_LABEL, type Quotation, type QuotationStatus } from "@/lib/quotations";
import { useWorkspaceRole } from "@/lib/use-workspace-role";

type StatusTone = "default" | "secondary" | "success" | "warning" | "danger";
const STATUS_TONE: Record<QuotationStatus, StatusTone> = { draft: "secondary", sent: "default", accepted: "success", rejected: "danger", expired: "warning" };

export function QuotationList() {
  const defaults = defaultQuotationDateRange();
  const { canWrite: allowWrite, canDelete: allowDelete } = useWorkspaceRole();
  const [rows, setRows] = useState<Quotation[]>([]);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchQuotations({ from, to, status, query }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "견적서를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id: string) {
    if (!confirm("이 견적서를 삭제할까요?")) return;
    try {
      await deleteQuotation(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  }

  async function convert(id: string) {
    try {
      const plan = await convertQuotation(id);
      location.assign(`/sales-plans/${plan.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "판매계획 전환에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">견적서조회</h2>
          <p className="text-xs text-muted-foreground">
            견적서 조회·수정·삭제와 수락 견적의 판매계획 전환을 관리합니다. 행을 클릭하면 상세 화면으로 이동합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="qt-from" className="sr-only">시작일</Label>
            <Input id="qt-from" type="date" className="h-8 w-[138px] text-xs" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-xs text-muted-foreground">~</span>
            <Label htmlFor="qt-to" className="sr-only">종료일</Label>
            <Input id="qt-to" type="date" className="h-8 w-[138px] text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">전체 상태</option>
            {Object.entries(QUOTATION_STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-48 pl-8 text-xs"
              placeholder="거래처·견적번호·품목"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
            />
          </div>
          <Button type="button" size="sm" className="h-8" onClick={() => void load()}>조회</Button>
        </div>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">견적일</th>
                  <th className="px-3 py-2.5">견적번호</th>
                  <th className="px-3 py-2.5">거래처</th>
                  <th className="px-3 py-2.5">담당자</th>
                  <th className="px-3 py-2.5">품목</th>
                  <th className="px-3 py-2.5 text-right">공급가</th>
                  <th className="px-3 py-2.5 text-right">VAT</th>
                  <th className="px-3 py-2.5 text-right">합계</th>
                  <th className="px-3 py-2.5">유효기간</th>
                  <th className="px-3 py-2.5">상태</th>
                  <th className="px-3 py-2.5">판매계획</th>
                  <th className="px-3 py-2.5 text-center">작업</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">불러오는 중…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">조회된 견적서가 없습니다.</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-indigo-50/40">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.quoteDate}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{row.slipNo}</td>
                      <td className="px-3 py-2 text-slate-700">{row.vendorName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.managerName ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{row.item}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">{formatKRW(row.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">{formatKRW(row.vat)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-slate-900">{formatKRW(row.total)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.validUntil ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_TONE[row.status as QuotationStatus]} className="text-[10px]">
                          {QUOTATION_STATUS_LABEL[row.status as QuotationStatus]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {row.convertedSalesPlanId ? (
                          <Link className="font-medium text-indigo-600 underline-offset-2 hover:underline" href={`/sales-plans/${row.convertedSalesPlanId}/edit`}>
                            {row.convertedSalesPlanSlipNo ?? "판매계획 보기"}
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          <Link href={`/quotations/${row.id}`}>
                            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]">
                              <Pencil className="h-3 w-3" />상세
                            </Button>
                          </Link>
                          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={!allowDelete || !(["draft", "sent"] as string[]).includes(row.status)} onClick={() => void remove(row.id)}>
                            삭제
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            disabled={!allowWrite || row.status !== "accepted" || Boolean(row.convertedSalesPlanId)}
                            title={row.status !== "accepted" ? "수락 견적만 전환할 수 있습니다." : row.convertedSalesPlanId ? "이미 판매계획으로 전환되었습니다." : undefined}
                            onClick={() => void convert(row.id)}
                          >
                            {row.convertedSalesPlanId ? "전환됨" : "판매계획 전환"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">{rows.length}건</p>
            <Link href="/quotations/new" aria-disabled={!allowWrite} tabIndex={allowWrite ? undefined : -1} className={cn(!allowWrite && "pointer-events-none")}>
              <Button type="button" size="sm" disabled={!allowWrite} className={cn("h-8 gap-1.5")}>
                <FilePlus2 className="h-3.5 w-3.5" />신규 견적
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

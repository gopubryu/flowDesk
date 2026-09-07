"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePlus2, RefreshCw } from "lucide-react";
import { fetchAdjustmentSlips } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-alert-dialog";

type Slip = {
  slipNo: string;
  date: string;
  warehouseCode: string;
  warehouseName?: string;
  vendorName?: string;
  manager?: string;
  memo?: string;
  relatedId?: string;
  totalQty: number;
  lineCount: number;
};

export default function AdjustmentsListPage() {
  const { alert: appAlert, dialog: appDialog } = useAppDialog();
  const [rows, setRows] = useState<Slip[]>([]);
  const [hydrated, setHydrated] = useState(false);

  async function load() {
    try {
      setRows(await fetchAdjustmentSlips());
    } catch (e) {
      console.error(e);
      await appAlert({
        title: "알림",
        description: e instanceof Error ? e.message : "조정 조회에 실패했어요.",
      });
    } finally {
      setHydrated(true);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {appDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">조정조회</h1>
          <p className="text-xs text-muted-foreground">재고조정 전표 목록이에요.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </Button>
          <Link
            href="/inventory/adjustments/new"
            className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            조정입력
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b bg-slate-50 text-[11px] font-semibold text-slate-500">
              <th className="px-3 py-2.5">일자</th>
              <th className="px-3 py-2.5">전표번호</th>
              <th className="px-3 py-2.5">창고</th>
              <th className="px-3 py-2.5">사유/메모</th>
              <th className="px-3 py-2.5 text-right">수량합계(절댓값)</th>
              <th className="px-3 py-2.5 text-right">라인</th>
              <th className="px-3 py-2.5">담당자</th>
            </tr>
          </thead>
          <tbody>
            {!hydrated ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">불러오는 중…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">조정전표가 없어요.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.slipNo} className="border-b border-slate-100 hover:bg-indigo-50/40">
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{r.slipNo}</td>
                  <td className="px-3 py-2">{r.warehouseName || r.warehouseCode}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-600">{r.memo || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.totalQty.toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.lineCount}</td>
                  <td className="px-3 py-2">{r.manager || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

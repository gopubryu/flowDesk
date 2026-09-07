"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePlus2, RefreshCw } from "lucide-react";
import { fetchShipmentSlips } from "@/lib/inventory";
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

export default function ShipmentsListPage() {
  const { alert: appAlert, dialog: appDialog } = useAppDialog();
  const [rows, setRows] = useState<Slip[]>([]);
  const [hydrated, setHydrated] = useState(false);

  async function load() {
    try {
      setRows(await fetchShipmentSlips());
    } catch (e) {
      console.error(e);
      await appAlert({
        title: "알림",
        description: e instanceof Error ? e.message : "출하 조회에 실패했어요.",
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
          <h1 className="text-lg font-bold text-slate-900">출하조회</h1>
          <p className="text-xs text-muted-foreground">출하전표 목록이에요.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            새로고침
          </Button>
          <Link
            href="/inventory/shipments/new"
            className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            출하입력
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
              <th className="px-3 py-2.5">거래처</th>
              <th className="px-3 py-2.5 text-right">수량합계</th>
              <th className="px-3 py-2.5 text-right">라인</th>
              <th className="px-3 py-2.5">담당자</th>
              <th className="px-3 py-2.5">메모</th>
            </tr>
          </thead>
          <tbody>
            {!hydrated ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">불러오는 중…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">출하전표가 없어요.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.slipNo} className="border-b border-slate-100 hover:bg-indigo-50/40">
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{r.slipNo}</td>
                  <td className="px-3 py-2">{r.warehouseName || r.warehouseCode}</td>
                  <td className="px-3 py-2">{r.vendorName || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.totalQty.toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.lineCount}</td>
                  <td className="px-3 py-2">{r.manager || "—"}</td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-slate-500">{r.memo || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

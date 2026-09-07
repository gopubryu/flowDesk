"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import {
  fetchMovements,
  MOVEMENT_TYPE_LABEL,
  todayISO,
  type StockMovementRow,
  type StockMovementType,
} from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TYPE_OPTS: { key: "" | StockMovementType; label: string }[] = [
  { key: "", label: "전체" },
  { key: "receipt", label: "입고" },
  { key: "shipment", label: "출하" },
  { key: "adjustment", label: "조정" },
];

function InventoryMovementsPageInner() {
  const searchParams = useSearchParams();
  const { alert: appAlert, dialog: appDialog } = useAppDialog();
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return todayISO(d);
  });
  const [dateTo, setDateTo] = useState(todayISO());
  const [warehouseCode, setWarehouseCode] = useState(
    searchParams.get("warehouseCode") || ""
  );
  const [itemCode, setItemCode] = useState(searchParams.get("itemCode") || "");
  const [type, setType] = useState<"" | StockMovementType>("");

  async function load(overrides?: Partial<{
    dateFrom: string;
    dateTo: string;
    warehouseCode: string;
    itemCode: string;
    type: string;
  }>) {
    try {
      const data = await fetchMovements({
        dateFrom: overrides?.dateFrom ?? dateFrom,
        dateTo: overrides?.dateTo ?? dateTo,
        warehouseCode: (overrides?.warehouseCode ?? warehouseCode) || undefined,
        itemCode: (overrides?.itemCode ?? itemCode) || undefined,
        type: (overrides?.type ?? type) || undefined,
      });
      setRows(data);
    } catch (e) {
      console.error(e);
      await appAlert({
        title: "알림",
        description: e instanceof Error ? e.message : "수불 조회에 실패했어요.",
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
          <h1 className="text-lg font-bold text-slate-900">수불조회</h1>
          <p className="text-xs text-muted-foreground">
            기간·창고·품목·유형으로 수불을 확인할 수 있어요.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={() => void load()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          새로고침
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-2 p-3">
          <div className="grid gap-1">
            <Label className="text-[11px] text-slate-500">기간</Label>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                className="h-8 w-[132px] text-xs"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-slate-400">~</span>
              <Input
                type="date"
                className="h-8 w-[132px] text-xs"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label className="text-[11px] text-slate-500">창고코드</Label>
            <Input
              className="h-8 w-28 text-xs"
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-[11px] text-slate-500">품목코드</Label>
            <Input
              className="h-8 w-28 text-xs"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-[11px] text-slate-500">유형</Label>
            <select
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
              value={type}
              onChange={(e) => setType(e.target.value as "" | StockMovementType)}
            >
              {TYPE_OPTS.map((o) => (
                <option key={o.key || "all"} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1"
            onClick={() => void load()}
          >
            <Search className="h-3.5 w-3.5" />
            조회
          </Button>
        </CardContent>
      </Card>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b bg-slate-50 text-[11px] font-semibold text-slate-500">
              <th className="px-3 py-2.5">일자</th>
              <th className="px-3 py-2.5">유형</th>
              <th className="px-3 py-2.5">전표번호</th>
              <th className="px-3 py-2.5">창고</th>
              <th className="px-3 py-2.5">품목</th>
              <th className="px-3 py-2.5 text-right">수량</th>
              <th className="px-3 py-2.5">거래처</th>
              <th className="px-3 py-2.5">메모</th>
            </tr>
          </thead>
          <tbody>
            {!hydrated ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  불러오는 중…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  조회된 수불이 없어요.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-indigo-50/40">
                  <td className="whitespace-nowrap px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        r.type === "receipt"
                          ? "success"
                          : r.type === "shipment"
                            ? "warning"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {MOVEMENT_TYPE_LABEL[r.type]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-medium tabular-nums">{r.slipNo}</td>
                  <td className="px-3 py-2">
                    {r.warehouseName || r.warehouseCode}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium tabular-nums">{r.itemCode}</span>
                    {r.itemName ? ` ${r.itemName}` : ""}
                  </td>
                  <td
                    className={
                      "px-3 py-2 text-right tabular-nums font-semibold " +
                      (r.qty < 0 ? "text-rose-600" : "text-emerald-700")
                    }
                  >
                    {r.qty > 0 ? "+" : ""}
                    {r.qty.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2">{r.vendorName || "—"}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-slate-500">
                    {r.memo || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export default function InventoryMovementsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">불러오는 중…</div>}>
      <InventoryMovementsPageInner />
    </Suspense>
  );
}

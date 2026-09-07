"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import {
  fetchBalances,
  type StockBalanceRow,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InventoryBalancesPage() {
  const router = useRouter();
  const { alert: appAlert, dialog: appDialog } = useAppDialog();
  const [rows, setRows] = useState<StockBalanceRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [warehouse, setWarehouse] = useState("");
  const [item, setItem] = useState("");
  const [applied, setApplied] = useState({ warehouse: "", item: "" });

  async function load() {
    try {
      const data = await fetchBalances();
      setRows(data);
    } catch (e) {
      console.error(e);
      await appAlert({
        title: "알림",
        description: e instanceof Error ? e.message : "재고 조회에 실패했어요.",
      });
    } finally {
      setHydrated(true);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (applied.warehouse.trim()) {
        const q = applied.warehouse.trim().toLowerCase();
        if (
          !r.warehouseCode.toLowerCase().includes(q) &&
          !(r.warehouseName || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (applied.item.trim()) {
        const q = applied.item.trim().toLowerCase();
        if (
          !r.itemCode.toLowerCase().includes(q) &&
          !(r.itemName || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rows, applied]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {appDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">재고조회</h1>
          <p className="text-xs text-muted-foreground">
            창고·품목별 현재고예요. 행을 누르면 해당 수불을 볼 수 있어요.
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
            <Label className="text-[11px] text-slate-500">창고</Label>
            <Input
              className="h-8 w-40 text-xs"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              placeholder="코드/명"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-[11px] text-slate-500">품목</Label>
            <Input
              className="h-8 w-44 text-xs"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="코드/명"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1"
            onClick={() => setApplied({ warehouse, item })}
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
              <th className="px-3 py-2.5">창고코드</th>
              <th className="px-3 py-2.5">창고명</th>
              <th className="px-3 py-2.5">품목코드</th>
              <th className="px-3 py-2.5">품목명</th>
              <th className="px-3 py-2.5 text-right">현재고</th>
            </tr>
          </thead>
          <tbody>
            {!hydrated ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  불러오는 중…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  조회된 재고가 없어요.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 hover:bg-indigo-50/40"
                  )}
                  onClick={() =>
                    router.push(
                      `/inventory/movements?warehouseCode=${encodeURIComponent(
                        r.warehouseCode
                      )}&itemCode=${encodeURIComponent(r.itemCode)}`
                    )
                  }
                >
                  <td className="px-3 py-2 font-medium tabular-nums">{r.warehouseCode}</td>
                  <td className="px-3 py-2">{r.warehouseName || "—"}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{r.itemCode}</td>
                  <td className="px-3 py-2">{r.itemName || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {r.qty.toLocaleString("ko-KR")}
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

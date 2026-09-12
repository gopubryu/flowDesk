"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { fetchInventoryStatus, fetchRelatedQty, computeInboundStatus, type InventoryStatusSummary } from "@/lib/inventory";
import { fetchPurchases, INBOUND_STATUS_LABEL } from "@/lib/purchases";
import { loadItems } from "@/lib/items";
import { OUTBOUND_STATUS_LABEL } from "@/lib/sales-plans";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function InventoryStatusPage() {
  const { alert: appAlert, dialog: appDialog } = useAppDialog();
  const [data, setData] = useState<InventoryStatusSummary | null>(null);
  const [items, setItems] = useState<Awaited<ReturnType<typeof loadItems>>>([]);
  const [pendingInbound, setPendingInbound] = useState<
    { id: string; vendor: string; item: string; remain: number; status: string }[]
  >([]);

  async function load() {
    try {
      const st = await fetchInventoryStatus();
      const masterItems = await loadItems();
      setData(st);
      setItems(masterItems);

      const purchases = (await fetchPurchases()).filter((p) => p.status === "confirmed");
      const ids = purchases.map((p) => p.id);
      const related = await fetchRelatedQty({ relatedType: "purchase", relatedIds: ids });
      const pending = purchases
        .map((p) => {
          const received = related[p.id] || 0;
          const status = computeInboundStatus(p.quantity, received);
          const remain = Math.max(0, p.quantity - received);
          return {
            id: p.id,
            vendor: p.vendor,
            item: p.item,
            remain,
            status,
          };
        })
        .filter((p) => p.status === "none" || p.status === "partial");
      setPendingInbound(pending);
    } catch (e) {
      console.error(e);
      await appAlert({
        title: "알림",
        description: e instanceof Error ? e.message : "현황 조회에 실패했어요.",
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const belowMin = useMemo(() => {
    if (!data) return [];
    const minMap = new Map(
      items
        .filter((i) => typeof i.minStock === "number" && (i.minStock as number) > 0)
        .map((i) => [i.code, i.minStock as number])
    );
    return (data.balances || [])
      .map((b) => {
        const minStock = minMap.get(b.itemCode) ?? 0;
        return { ...b, minStock };
      })
      .filter((b) => b.minStock > 0 && b.qty < b.minStock);
  }, [data, items]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {appDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">재고 현황</h1>
          <p className="text-xs text-muted-foreground">
            미입고·미출하·안전재고·오늘 입출고를 한눈에 볼 수 있어요.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          새로고침
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground">오늘 입고</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {(data?.todayIn ?? 0).toLocaleString("ko-KR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground">오늘 출하</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">
              {(data?.todayOut ?? 0).toLocaleString("ko-KR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground">미입고 건수</p>
            <p className="mt-1 text-2xl font-bold">{pendingInbound.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground">미출하 건수</p>
            <p className="mt-1 text-2xl font-bold">{data?.pendingOutbound.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        <section className="overflow-auto rounded-xl border bg-white">
          <div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold">미입고</div>
          <ul className="divide-y text-xs">
            {pendingInbound.length === 0 ? (
              <li className="px-3 py-6 text-center text-muted-foreground">없어요.</li>
            ) : (
              pendingInbound.slice(0, 30).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div>
                    <p className="font-medium">{p.vendor}</p>
                    <p className="text-slate-500">{p.item}</p>
                    <Badge variant="warning" className="mt-1 text-[10px]">
                      {INBOUND_STATUS_LABEL[p.status as "none" | "partial" | "complete"]}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-semibold text-amber-700">
                      {p.remain.toLocaleString("ko-KR")}
                    </p>
                    <Link
                      href={`/inventory/receipts/new?purchaseId=${p.id}`}
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      입고하기
                    </Link>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="overflow-auto rounded-xl border bg-white">
          <div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold">미출하</div>
          <ul className="divide-y text-xs">
            {(data?.pendingOutbound.length ?? 0) === 0 ? (
              <li className="px-3 py-6 text-center text-muted-foreground">없어요.</li>
            ) : (
              data!.pendingOutbound.slice(0, 30).map((p) => (
                <li key={p.relatedId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div>
                    <p className="font-medium">{p.vendorName || "—"}</p>
                    <p className="text-slate-500">{p.itemLabel}</p>
                    <Badge variant="warning" className="mt-1 text-[10px]">
                      {OUTBOUND_STATUS_LABEL.none}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-semibold text-amber-700">
                      {p.remainQty.toLocaleString("ko-KR")}
                    </p>
                    <Link
                      href={`/inventory/shipments/new?salesPlanId=${p.relatedId}`}
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      출하하기
                    </Link>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="overflow-auto rounded-xl border bg-white">
          <div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold">안전재고 미달</div>
          <ul className="divide-y text-xs">
            {belowMin.length === 0 ? (
              <li className="px-3 py-6 text-center text-muted-foreground">없어요.</li>
            ) : (
              belowMin.slice(0, 30).map((b) => (
                <li key={`${b.warehouseCode}-${b.itemCode}`} className="px-3 py-2">
                  <p className="font-medium">
                    {b.itemCode} {b.itemName || ""}
                  </p>
                  <p className="text-slate-500">
                    {b.warehouseName || b.warehouseCode} · 현재 {b.qty.toLocaleString("ko-KR")} / 안전{" "}
                    {b.minStock.toLocaleString("ko-KR")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

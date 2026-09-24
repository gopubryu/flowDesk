"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, Search } from "lucide-react";
import {
  createShipment,
  fetchBalances,
  fetchNextSlipNo,
  fetchRelatedQty,
  todayISO,
} from "@/lib/inventory";
import { loadItems } from "@/lib/items";
import { withEulReul } from "@/lib/josa";
import {
  OUTBOUND_STATUS_LABEL,
  fetchSalesPlans,
  type SalesPlan,
  type OutboundStatus,
} from "@/lib/sales-plans";
import { loadWarehouses } from "@/lib/warehouses";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { Input } from "@/components/ui/input";
import { WarehouseSearchDialog } from "@/components/warehouses/warehouse-search-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspaceRole } from "@/lib/use-workspace-role";

type GridRow = {
  itemCode: string;
  itemName: string;
  spec: string;
  unit: string;
  planQty: number;
  alreadyQty: number;
  remainQty: number;
  stockQty: number;
  thisQty: string;
  memo: string;
};

function ShipmentNewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert: appAlert, confirm: appConfirm, dialog: appDialog } = useAppDialog();

  const [date, setDate] = useState(todayISO());
  const [slipNo, setSlipNo] = useState("");
  const [planId, setPlanId] = useState(searchParams.get("salesPlanId") || "");
  const [planLabel, setPlanLabel] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [manager, setManager] = useState("");
  const [memo, setMemo] = useState("");
  const [rows, setRows] = useState<GridRow[]>([]);
  const [plans, setPlans] = useState<SalesPlan[]>([]);
  const [whOpen, setWhOpen] = useState(false);
  const [spOpen, setSpOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { canWrite: allowWrite } = useWorkspaceRole();

  useEffect(() => {
    void (async () => {
      try {
        setSlipNo(await fetchNextSlipNo("shipment", date));
      } catch { /* ignore */ }
    })();
  }, [date]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchSalesPlans();
        setPlans(list);
        const sid = searchParams.get("salesPlanId");
        if (sid) {
          const p = list.find((x) => x.id === sid);
          if (p) await applyPlan(p);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshStock(code: string, grid: GridRow[]) {
    if (!code) {
      setRows(grid.map((r) => ({ ...r, stockQty: 0 })));
      return;
    }
    try {
      const bals = await fetchBalances({ warehouseCode: code });
      const map = new Map(bals.map((b) => [b.itemCode, b.qty]));
      setRows(
        grid.map((r) => ({
          ...r,
          stockQty: map.get(r.itemCode) ?? 0,
        }))
      );
    } catch {
      setRows(grid);
    }
  }

  async function applyPlan(p: SalesPlan) {
    setPlanId(p.id);
    setPlanLabel(`${p.planDate} / ${p.slipNo || p.id} / ${p.vendor}`);
    setVendorCode(p.vendorCode || "");
    setVendorName(p.vendor);
    setManager(p.manager || "");

    if (p.warehouse) {
      const wh = (await loadWarehouses()).find(
        (w) => w.name === p.warehouse || w.code === p.warehouse
      );
      const code = wh?.code || "";
      const name = wh?.name || p.warehouse;
      setWarehouseCode(code);
      setWarehouseName(name);
    }

    const related = await fetchRelatedQty({
      relatedType: "salesPlan",
      relatedIds: [p.id],
    });
    const alreadyTotal = related[p.id] || 0;

    const lineSources =
      p.lines && p.lines.length > 0
        ? p.lines.map((l) => ({
            itemCode: l.itemCode || "",
            itemName: l.itemName,
            spec: l.spec || "",
            unit: "",
            qty: l.qty,
          }))
        : [
            {
              itemCode: p.itemCode || "",
              itemName: p.item,
              spec: p.spec || "",
              unit: "",
              qty: p.quantity,
            },
          ];

    const grid: GridRow[] = lineSources.map((l, idx) => {
      const planQty = l.qty;
      const alreadyQty = lineSources.length === 1 ? alreadyTotal : idx === 0 ? alreadyTotal : 0;
      const remainQty = Math.max(0, planQty - alreadyQty);
      return {
        itemCode: l.itemCode,
        itemName: l.itemName,
        spec: l.spec,
        unit: l.unit,
        planQty,
        alreadyQty,
        remainQty,
        stockQty: 0,
        thisQty: "",
        memo: "",
      };
    });

    const whCode =
      (await loadWarehouses()).find((w) => w.name === p.warehouse || w.code === p.warehouse)
        ?.code || warehouseCode;
    await refreshStock(whCode, grid);
  }

  const eligiblePlans = useMemo(() => {
    return plans.filter((p) => {
      if (p.status !== "confirmed" && p.status !== "in_progress") return false;
      const st = p.outboundStatus || "none";
      return st === "none" || st === "partial";
    });
  }, [plans, spOpen]);

  async function handleSave() {
    if (!warehouseCode.trim()) {
      await appAlert({ title: "알림", description: "출하창고를 선택해 주세요." });
      return;
    }
    const items = await loadItems();
    const lines = rows
      .map((r) => {
        const qty = Number(r.thisQty) || 0;
        if (qty <= 0) return null;
        let code = r.itemCode.trim();
        if (code.startsWith("NAME:")) code = "";
        if (!code && r.itemName.trim()) {
          const hit = items.find((i) => i.name === r.itemName.trim());
          code = hit?.code || "";
        }
        return {
          itemCode: code,
          itemName: r.itemName,
          itemSpec: r.spec || undefined,
          itemUnit: r.unit || undefined,
          qty,
          memo: r.memo || undefined,
        };
      })
      .filter((l): l is NonNullable<typeof l> => !!l);

    const missingCode = lines.find((l) => !l.itemCode);
    if (missingCode) {
      await appAlert({
        title: "알림",
        description: `품목코드가 없는 라인이 있어요: ${missingCode.itemName || "(이름 없음)"}. 마스터 품목코드를 입력해 주세요.`,
      });
      return;
    }
    if (lines.length === 0) {
      await appAlert({
        title: "알림",
        description: "이번출하 수량이 0보다 큰 품목을 입력해 주세요.",
      });
      return;
    }

    for (const r of rows) {
      const q = Number(r.thisQty) || 0;
      if (q <= 0) continue;
      if (q > r.remainQty + 1e-9) {
        await appAlert({
          title: "알림",
          description: `[${r.itemCode}] 이번출하는 미출하(${r.remainQty}) 이하여야 해요.`,
        });
        return;
      }
      if (q > r.stockQty + 1e-9) {
        await appAlert({
          title: "알림",
          description: `[${r.itemCode}] 재고가 부족해요. 현재고 ${r.stockQty}, 요청 ${q}`,
        });
        return;
      }
    }

    const ok = await appConfirm({
      title: "출하 저장",
      description: "출하전표를 저장할까요? 재고에서 차감돼요.",
      confirmLabel: "저장",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await createShipment({
        date,
        slipNo,
        warehouseCode,
        warehouseName,
        manager,
        memo,
        relatedType: planId ? "salesPlan" : undefined,
        relatedId: planId || undefined,
        vendorCode: vendorCode || undefined,
        vendorName: vendorName || undefined,
        lines,
      });
      await appAlert({
        title: "알림",
        description: `출하전표 ${withEulReul(res.slipNo)} 저장했어요.`,
      });
      router.push("/inventory/shipments");
    } catch (e) {
      await appAlert({
        title: "알림",
        description: e instanceof Error ? e.message : "출하 저장에 실패했어요.",
      });
    } finally {
      setSaving(false);
    }
  }

  const fieldCls =
    "h-8 rounded border border-slate-200 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-indigo-500";
  const labelCls =
    "flex h-8 min-w-[88px] shrink-0 items-center bg-slate-100 px-2 text-[11px] font-medium text-slate-600";

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {appDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">출하입력</h1>
          <p className="text-xs text-muted-foreground">
            판매계획을 불러와 출하합니다. 재고가 부족하면 저장되지 않아요.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1"
          disabled={saving || !allowWrite}
          onClick={() => void handleSave()}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2">
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>출하일자</span>
          <Input type="date" className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>전표번호</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={slipNo} readOnly />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200 md:col-span-2">
          <span className={labelCls}>판매계획</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={planLabel} readOnly placeholder="확인/진행 + 미출하/부분만" />
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-none border-0 border-l" onClick={() => setSpOpen(true)}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>거래처</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none bg-slate-50")} value={vendorName} readOnly />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>출하창고</span>
          <Input className={cn(fieldCls, "w-20 border-0 shadow-none")} value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)} />
          <Input className={cn(fieldCls, "flex-1 border-0 border-l shadow-none")} value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} />
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-none border-0 border-l" onClick={() => setWhOpen(true)}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>담당자</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={manager} onChange={(e) => setManager(e.target.value)} />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>메모</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b bg-slate-50 text-[11px] font-semibold text-slate-500">
              <th className="px-2 py-2">품목코드</th>
              <th className="px-2 py-2">품목명</th>
              <th className="px-2 py-2">규격</th>
              <th className="px-2 py-2 text-right">계획수량</th>
              <th className="px-2 py-2 text-right">기출하</th>
              <th className="px-2 py-2 text-right">미출하</th>
              <th className="px-2 py-2 text-right">현재고</th>
              <th className="px-2 py-2 text-right">이번출하</th>
              <th className="px-2 py-2">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  판매계획을 선택해 주세요.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-7 text-xs tabular-nums"
                      value={r.itemCode}
                      placeholder="코드"
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, itemCode: v } : row
                          )
                        );
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">{r.itemName}</td>
                  <td className="px-2 py-1.5 text-slate-500">{r.spec || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.planQty.toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.alreadyQty.toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">{r.remainQty.toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{r.stockQty.toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-7 text-right text-xs"
                      value={r.thisQty}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, thisQty: v } : row)));
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-7 text-xs"
                      value={r.memo}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, memo: v } : row)));
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <WarehouseSearchDialog
        open={whOpen}
        onOpenChange={setWhOpen}
        onSelect={(wh) => {
          setWarehouseCode(wh.code);
          setWarehouseName(wh.name);
          setWhOpen(false);
          void refreshStock(wh.code, rows);
        }}
      />

      <Dialog open={spOpen} onOpenChange={setSpOpen}>
        <DialogContent className="max-w-2xl rounded-2xl p-0" onClose={() => setSpOpen(false)}>
          <div className="border-b bg-gradient-to-r from-indigo-50 to-slate-50 px-5 py-4">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-base">판매계획 찾기</DialogTitle>
              <p className="mt-1 text-xs text-slate-500">확인/진행이며 미출하·부분출하인 계획만 보여요.</p>
            </DialogHeader>
          </div>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="px-3 py-2">일자</th>
                  <th className="px-3 py-2">거래처</th>
                  <th className="px-3 py-2">품목</th>
                  <th className="px-3 py-2 text-right">수량</th>
                  <th className="px-3 py-2">출하상태</th>
                </tr>
              </thead>
              <tbody>
                {eligiblePlans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">대상 판매계획이 없어요.</td>
                  </tr>
                ) : (
                  eligiblePlans.map((p) => {
                    const st = (p.outboundStatus || "none") as OutboundStatus;
                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer border-b hover:bg-indigo-50/60"
                        onClick={() => {
                          void applyPlan(p);
                          setSpOpen(false);
                        }}
                      >
                        <td className="px-3 py-2">{p.planDate}</td>
                        <td className="px-3 py-2">{p.vendor}</td>
                        <td className="px-3 py-2">{p.item}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.quantity.toLocaleString("ko-KR")}</td>
                        <td className="px-3 py-2">{OUTBOUND_STATUS_LABEL[st]}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" size="sm" variant="ghost" onClick={() => setSpOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function ShipmentNewPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">불러오는 중…</div>}>
      <ShipmentNewPageInner />
    </Suspense>
  );
}

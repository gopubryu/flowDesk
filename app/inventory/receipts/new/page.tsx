"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, Search } from "lucide-react";
import {
  createReceipt,
  fetchNextSlipNo,
  fetchRelatedQty,
  todayISO,
} from "@/lib/inventory";
import {
  INBOUND_STATUS_LABEL,
  loadPurchases,
  resolveInboundStatus,
  savePurchases,
  type Purchase,
  type InboundStatus,
} from "@/lib/purchases";
import { loadItems } from "@/lib/items";
import { loadWarehouses } from "@/lib/warehouses";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WarehouseSearchDialog } from "@/components/warehouses/warehouse-search-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type GridRow = {
  itemCode: string;
  itemName: string;
  spec: string;
  unit: string;
  purchaseQty: number;
  alreadyQty: number;
  remainQty: number;
  thisQty: string;
  memo: string;
};

function ReceiptNewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert: appAlert, confirm: appConfirm, dialog: appDialog } = useAppDialog();

  const [date, setDate] = useState(todayISO());
  const [slipNo, setSlipNo] = useState("");
  const [purchaseId, setPurchaseId] = useState(searchParams.get("purchaseId") || "");
  const [purchaseLabel, setPurchaseLabel] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [manager, setManager] = useState("");
  const [memo, setMemo] = useState("");
  const [rows, setRows] = useState<GridRow[]>([]);
  const [whOpen, setWhOpen] = useState(false);
  const [puOpen, setPuOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const no = await fetchNextSlipNo("receipt", date);
        setSlipNo(no);
      } catch {
        /* ignore */
      }
    })();
  }, [date]);

  async function applyPurchase(p: Purchase) {
    setPurchaseId(p.id);
    setPurchaseLabel(`${p.purchaseDate} / ${p.orderNo || p.id} / ${p.vendor}`);
    setVendorCode(p.vendorCode || "");
    setVendorName(p.vendor);
    setManager(p.manager || "");

    // warehouse: prefer code, else match by name
    if (p.warehouseCode) {
      setWarehouseCode(p.warehouseCode);
      setWarehouseName(p.warehouse || "");
    } else if (p.warehouse) {
      const wh = loadWarehouses().find(
        (w) => w.name === p.warehouse || w.code === p.warehouse
      );
      setWarehouseCode(wh?.code || "");
      setWarehouseName(wh?.name || p.warehouse);
    }

    const related = await fetchRelatedQty({
      relatedType: "purchase",
      relatedIds: [p.id],
    });
    const alreadyTotal = related[p.id] || 0;

    const items = loadItems();
    const lineSources =
      p.lines && p.lines.length > 0
        ? p.lines
        : [
            {
              itemCode: p.itemCode,
              itemName: p.item,
              spec: undefined as string | undefined,
              unit: undefined as string | undefined,
              qty: p.quantity,
            },
          ];

    // Distribute already received across lines proportionally by qty for display;
    // for single-line purchases use full alreadyTotal.
    const grid: GridRow[] = lineSources.map((l, idx) => {
      const code =
        (l.itemCode || "").trim() ||
        items.find((i) => i.name === l.itemName)?.code ||
        "";
      const master = items.find((i) => i.code === code);
      const purchaseQty = l.qty;
      const alreadyQty =
        lineSources.length === 1
          ? alreadyTotal
          : idx === 0
            ? alreadyTotal
            : 0;
      const remainQty = Math.max(0, purchaseQty - alreadyQty);
      return {
        itemCode: code,
        itemName: l.itemName,
        spec: l.spec || master?.spec || "",
        unit: l.unit || master?.unit || "",
        purchaseQty,
        alreadyQty,
        remainQty,
        thisQty: remainQty > 0 ? String(remainQty) : "",
        memo: "",
      };
    });
    setRows(grid);
  }

  useEffect(() => {
    const pid = searchParams.get("purchaseId");
    if (!pid) return;
    const p = loadPurchases().find((x) => x.id === pid);
    if (p) void applyPurchase(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eligiblePurchases = useMemo(() => {
    return loadPurchases().filter((p) => {
      if (p.status !== "confirmed") return false;
      const st = p.inboundStatus || "none";
      return st === "none" || st === "partial";
    });
  }, [puOpen]);

  async function handleSave() {
    if (!warehouseCode.trim()) {
      await appAlert({ title: "알림", description: "입고창고를 선택해 주세요." });
      return;
    }
    const lines = rows
      .map((r) => {
        const code =
          r.itemCode.trim() ||
          (r.itemName.trim() ? `NAME:${r.itemName.trim()}` : "");
        return {
          itemCode: code,
          itemName: r.itemName,
          itemSpec: r.spec || undefined,
          itemUnit: r.unit || undefined,
          qty: Number(r.thisQty) || 0,
          memo: r.memo || undefined,
        };
      })
      .filter((l) => l.itemCode && l.qty > 0);

    if (lines.length === 0) {
      await appAlert({
        title: "알림",
        description: "이번입고 수량이 0보다 큰 품목을 입력해 주세요.",
      });
      return;
    }

    for (const r of rows) {
      const q = Number(r.thisQty) || 0;
      if (q < 0) {
        await appAlert({ title: "알림", description: "이번입고는 0 이상이어야 해요." });
        return;
      }
      if (q > r.remainQty + 1e-9) {
        await appAlert({
          title: "알림",
          description: `[${r.itemCode || r.itemName}] 이번입고는 미입고(${r.remainQty}) 이하여야 해요.`,
        });
        return;
      }
    }

    const ok = await appConfirm({
      title: "입고 저장",
      description: "입고전표를 저장할까요? 재고에 반영돼요.",
      confirmLabel: "저장",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await createReceipt({
        date,
        slipNo,
        warehouseCode,
        warehouseName,
        manager,
        memo,
        relatedType: purchaseId ? "purchase" : undefined,
        relatedId: purchaseId || undefined,
        vendorCode: vendorCode || undefined,
        vendorName: vendorName || undefined,
        lines,
      });

      if (purchaseId) {
        const purchases = loadPurchases();
        const target = purchases.find((p) => p.id === purchaseId);
        if (target) {
          const status = resolveInboundStatus(
            target.quantity,
            res.relatedReceivedQty
          );
          savePurchases(
            purchases.map((p) =>
              p.id === purchaseId ? { ...p, inboundStatus: status } : p
            )
          );
        }
      }

      await appAlert({
        title: "알림",
        description: `입고전표 ${res.slipNo}을(를) 저장했어요.`,
      });
      router.push("/inventory/receipts");
    } catch (e) {
      await appAlert({
        title: "알림",
        description: e instanceof Error ? e.message : "입고 저장에 실패했어요.",
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
          <h1 className="text-lg font-bold text-slate-900">입고입력</h1>
          <p className="text-xs text-muted-foreground">
            구매전표를 불러와 입고수량을 입력하면 재고에 반영돼요.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2">
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>입고일자</span>
          <Input
            type="date"
            className={cn(fieldCls, "flex-1 border-0 shadow-none")}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>전표번호</span>
          <Input
            className={cn(fieldCls, "flex-1 border-0 shadow-none")}
            value={slipNo}
            readOnly
          />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200 md:col-span-2">
          <span className={labelCls}>구매전표</span>
          <Input
            className={cn(fieldCls, "flex-1 border-0 shadow-none")}
            value={purchaseLabel}
            readOnly
            placeholder="확인 + 미입고/부분입고 구매만 선택"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-none border-0 border-l"
            onClick={() => setPuOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>거래처</span>
          <Input
            className={cn(fieldCls, "flex-1 border-0 shadow-none bg-slate-50")}
            value={vendorName}
            readOnly
          />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>입고창고</span>
          <Input
            className={cn(fieldCls, "w-20 border-0 shadow-none")}
            value={warehouseCode}
            onChange={(e) => setWarehouseCode(e.target.value)}
            placeholder="코드"
          />
          <Input
            className={cn(fieldCls, "flex-1 border-0 border-l shadow-none")}
            value={warehouseName}
            onChange={(e) => setWarehouseName(e.target.value)}
            placeholder="창고명"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-none border-0 border-l"
            onClick={() => setWhOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>담당자</span>
          <Input
            className={cn(fieldCls, "flex-1 border-0 shadow-none")}
            value={manager}
            onChange={(e) => setManager(e.target.value)}
          />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>메모</span>
          <Input
            className={cn(fieldCls, "flex-1 border-0 shadow-none")}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b bg-slate-50 text-[11px] font-semibold text-slate-500">
              <th className="px-2 py-2">품목코드</th>
              <th className="px-2 py-2">품목명</th>
              <th className="px-2 py-2">규격</th>
              <th className="px-2 py-2">단위</th>
              <th className="px-2 py-2 text-right">구매수량</th>
              <th className="px-2 py-2 text-right">기입고</th>
              <th className="px-2 py-2 text-right">미입고</th>
              <th className="px-2 py-2 text-right">이번입고</th>
              <th className="px-2 py-2">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  구매전표를 선택해 주세요.
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
                  <td className="px-2 py-1.5">{r.unit || "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {r.purchaseQty.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {r.alreadyQty.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">
                    {r.remainQty.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-7 text-right text-xs"
                      value={r.thisQty}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, thisQty: v } : row
                          )
                        );
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-7 text-xs"
                      value={r.memo}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, memo: v } : row
                          )
                        );
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
        }}
      />

      <Dialog open={puOpen} onOpenChange={setPuOpen}>
        <DialogContent
          className="max-w-2xl rounded-2xl p-0"
          onClose={() => setPuOpen(false)}
        >
          <div className="border-b bg-gradient-to-r from-indigo-50 to-slate-50 px-5 py-4">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-base">구매전표 찾기</DialogTitle>
              <p className="mt-1 text-xs text-slate-500">
                확인 상태이며 미입고·부분입고인 구매만 보여요.
              </p>
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
                  <th className="px-3 py-2">입고상태</th>
                </tr>
              </thead>
              <tbody>
                {eligiblePurchases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                      대상 구매가 없어요.
                    </td>
                  </tr>
                ) : (
                  eligiblePurchases.map((p) => {
                    const st = (p.inboundStatus || "none") as InboundStatus;
                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer border-b hover:bg-indigo-50/60"
                        onClick={() => {
                          void applyPurchase(p);
                          setPuOpen(false);
                        }}
                      >
                        <td className="px-3 py-2">{p.purchaseDate}</td>
                        <td className="px-3 py-2">{p.vendor}</td>
                        <td className="px-3 py-2">{p.item}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.quantity.toLocaleString("ko-KR")}
                        </td>
                        <td className="px-3 py-2">{INBOUND_STATUS_LABEL[st]}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" size="sm" variant="ghost" onClick={() => setPuOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function ReceiptNewPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">불러오는 중…</div>}>
      <ReceiptNewPageInner />
    </Suspense>
  );
}

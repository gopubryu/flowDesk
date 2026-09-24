"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Search } from "lucide-react";
import {
  createAdjustment,
  fetchBalances,
  todayISO,
} from "@/lib/inventory";
import { withEulReul } from "@/lib/josa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWorkspaceRole } from "@/lib/use-workspace-role";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { Input } from "@/components/ui/input";
import { WarehouseSearchDialog } from "@/components/warehouses/warehouse-search-dialog";
import { ItemSearchDialog } from "@/components/items/item-search-dialog";

export default function AdjustmentNewPage() {
  const router = useRouter();
  const { alert: appAlert, confirm: appConfirm, dialog: appDialog } = useAppDialog();
  const [date, setDate] = useState(todayISO());
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [bookQty, setBookQty] = useState(0);
  const [actualQty, setActualQty] = useState("");
  const [reason, setReason] = useState("");
  const [manager, setManager] = useState("");
  const [whOpen, setWhOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { canWrite: allowWrite } = useWorkspaceRole();

  const diff =
    actualQty === "" ? 0 : (Number(actualQty) || 0) - bookQty;

  async function loadBook() {
    if (!warehouseCode || !itemCode) {
      setBookQty(0);
      return;
    }
    try {
      const bals = await fetchBalances({ warehouseCode, itemCode });
      setBookQty(bals[0]?.qty ?? 0);
    } catch {
      setBookQty(0);
    }
  }

  useEffect(() => {
    void loadBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseCode, itemCode]);

  async function handleSave() {
    if (!warehouseCode.trim()) {
      await appAlert({ title: "알림", description: "창고를 선택해 주세요." });
      return;
    }
    if (!itemCode.trim()) {
      await appAlert({ title: "알림", description: "품목을 선택해 주세요." });
      return;
    }
    if (!reason.trim()) {
      await appAlert({ title: "알림", description: "조정 사유는 필수예요." });
      return;
    }
    if (actualQty === "") {
      await appAlert({ title: "알림", description: "실사수량을 입력해 주세요." });
      return;
    }
    const actual = Number(actualQty);
    if (!Number.isFinite(actual)) {
      await appAlert({ title: "알림", description: "실사수량이 올바르지 않아요." });
      return;
    }
    if (Math.abs(actual - bookQty) < 1e-9) {
      await appAlert({
        title: "알림",
        description: "장부수량과 실사수량이 같아 조정이 필요 없어요.",
      });
      return;
    }
    const ok = await appConfirm({
      title: "조정 저장",
      description: `차이 ${withEulReul(String(actual - bookQty))} 재고에 반영할까요?`,
      confirmLabel: "저장",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await createAdjustment({
        date,
        warehouseCode,
        warehouseName,
        itemCode,
        itemName,
        bookQty,
        actualQty: actual,
        reason,
        manager,
      });
      await appAlert({
        title: "알림",
        description: `조정전표 ${withEulReul(res.slipNo)} 저장했어요.`,
      });
      router.push("/inventory/adjustments");
    } catch (e) {
      await appAlert({
        title: "알림",
        description: e instanceof Error ? e.message : "조정 저장에 실패했어요.",
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
          <h1 className="text-lg font-bold text-slate-900">조정입력</h1>
          <p className="text-xs text-muted-foreground">
            실사수량과 장부수량의 차이를 조정으로 반영해요.
          </p>
        </div>
        <Button type="button" size="sm" className="h-8 gap-1" disabled={saving || !allowWrite} onClick={() => void handleSave()}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>

      <div className="grid max-w-2xl gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>조정일자</span>
          <Input type="date" className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>창고</span>
          <Input className={cn(fieldCls, "w-20 border-0 shadow-none")} value={warehouseCode} readOnly />
          <Input className={cn(fieldCls, "flex-1 border-0 border-l shadow-none")} value={warehouseName} readOnly />
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-none border-0 border-l" onClick={() => setWhOpen(true)}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>품목</span>
          <Input className={cn(fieldCls, "w-20 border-0 shadow-none")} value={itemCode} readOnly />
          <Input className={cn(fieldCls, "flex-1 border-0 border-l shadow-none")} value={itemName} readOnly />
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-none border-0 border-l" onClick={() => setItemOpen(true)}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>장부수량</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none bg-slate-50")} value={bookQty.toLocaleString("ko-KR")} readOnly />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>실사수량</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={actualQty} onChange={(e) => setActualQty(e.target.value)} />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>차이</span>
          <Input
            className={cn(
              fieldCls,
              "flex-1 border-0 shadow-none bg-slate-50 font-semibold",
              diff < 0 ? "text-rose-600" : diff > 0 ? "text-emerald-700" : ""
            )}
            value={diff.toLocaleString("ko-KR")}
            readOnly
          />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>사유</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="필수" />
        </div>
        <div className="flex overflow-hidden rounded border border-slate-200">
          <span className={labelCls}>담당자</span>
          <Input className={cn(fieldCls, "flex-1 border-0 shadow-none")} value={manager} onChange={(e) => setManager(e.target.value)} />
        </div>
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
      <ItemSearchDialog
        open={itemOpen}
        onOpenChange={setItemOpen}
        onSelect={(item) => {
          setItemCode(item.code);
          setItemName(item.name);
          setItemOpen(false);
        }}
      />
    </div>
  );
}

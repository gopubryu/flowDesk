"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { savePurchaseApi, type Purchase } from "@/lib/purchases";

export function ImportCustomsDialog({
  purchase,
  open,
  onOpenChange,
  onSaved,
}: {
  purchase: Purchase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { alert: appAlert } = useAppDialog();
  const [customsDate, setCustomsDate] = useState("");
  const [customsExchangeRate, setCustomsExchangeRate] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [importVatBaseAmount, setImportVatBaseAmount] = useState("");
  const [importVat, setImportVat] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = Boolean(purchase?.accountingReflect);

  useEffect(() => {
    if (!purchase) return;
    setCustomsDate(purchase.customsDate ?? "");
    setCustomsExchangeRate(purchase.customsExchangeRate ?? "");
    setBaseAmount(purchase.baseAmount ?? "");
    setImportVatBaseAmount(purchase.importVatBaseAmount ?? "");
    setImportVat(purchase.importVat ?? "");
  }, [purchase]);

  async function save() {
    if (!purchase || locked || saving) return;
    setSaving(true);
    try {
      await savePurchaseApi({
        ...purchase,
        customsDate,
        customsExchangeRate,
        baseAmount,
        importVatBaseAmount,
        importVat,
      });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      await appAlert({
        title: "통관 정보 저장 실패",
        description: error instanceof Error ? error.message : "통관 정보 저장에 실패했습니다.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{locked ? "통관 정보 잠금" : purchase?.customsDate ? "통관 정보 수정" : "통관 정보 입력"}</DialogTitle>
          <p className="text-xs text-muted-foreground">{purchase?.vendor} · {purchase?.item}</p>
        </DialogHeader>
        {locked && (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            회계 반영이 완료된 문서는 통관 정보를 수정할 수 없습니다.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-slate-600">통관일<input type="date" required disabled={locked} value={customsDate} onChange={(e) => setCustomsDate(e.target.value)} className="mt-1 h-8 w-full rounded border px-2 text-xs" /></label>
          <label className="text-xs font-medium text-slate-600">과세환율 ({purchase?.currency === "JPY" ? "원/100엔" : "원/달러"})<Input required disabled={locked} value={customsExchangeRate} onChange={(e) => setCustomsExchangeRate(e.target.value)} className="mt-1 h-8" /></label>
          <label className="text-xs font-medium text-slate-600">원화 환산액 (원)<Input required disabled={locked} value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} className="mt-1 h-8" /></label>
          <label className="text-xs font-medium text-slate-600">수입 VAT 과세표준 (원)<Input required disabled={locked} value={importVatBaseAmount} onChange={(e) => setImportVatBaseAmount(e.target.value)} className="mt-1 h-8" /></label>
          <label className="col-span-2 text-xs font-medium text-slate-600">수입 VAT (원)<Input required disabled={locked} value={importVat} onChange={(e) => setImportVat(e.target.value)} className="mt-1 h-8" /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button type="button" disabled={locked || saving} onClick={() => void save()}>{saving ? "저장 중…" : "저장"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  nextItemCode,
  upsertItem,
  type Item,
} from "@/lib/items";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatNumberWithComma,
  parseNumberInput,
  parseNonNegNumber,
} from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: Item) => void;
};

type FormState = {
  code: string;
  name: string;
  spec: string;
  unit: string;
  minStock: string;
  inboundPrice: string;
  inboundVatIncluded: boolean;
  outboundPrice: string;
  outboundVatIncluded: boolean;
};

function emptyForm(): FormState {
  return {
    code: nextItemCode(),
    name: "",
    spec: "",
    unit: "",
    minStock: "0",
    inboundPrice: "0",
    inboundVatIncluded: false,
    outboundPrice: "0",
    outboundVatIncluded: false,
  };
}

function CommaNumberInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (plain: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : formatNumberWithComma(value);

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      value={display}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(parseNumberInput(e.target.value))}
    />
  );
}

export function ItemRegisterDialog({ open, onOpenChange, onSaved }: Props) {
  const { alert: appAlert, dialog: appDialog } = useAppDialog();
  const [form, setForm] = useState<FormState>(() => emptyForm());

  useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleReset() {
    setForm(emptyForm());
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      await appAlert({ title: "알림", description: "품목코드와 품목명은 필수입니다." });
      return;
    }
    const saved: Item = {
      code: form.code.trim(),
      name: form.name.trim(),
      spec: form.spec.trim() || undefined,
      unit: form.unit.trim() || undefined,
      stockQty: 0,
      minStock: parseNonNegNumber(form.minStock) || undefined,
      inboundPrice: parseNonNegNumber(form.inboundPrice),
      inboundVatIncluded: form.inboundVatIncluded,
      outboundPrice: parseNonNegNumber(form.outboundPrice),
      outboundVatIncluded: form.outboundVatIncluded,
    };
    upsertItem(saved);
    onSaved(saved);
    onOpenChange(false);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl border-slate-200 p-0 shadow-xl"
        onClose={() => onOpenChange(false)}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 px-5 py-4 pr-12">
          <DialogHeader className="mb-0">
            <DialogTitle className="text-base text-slate-900">품목 등록</DialogTitle>
            <p className="mt-1 text-xs text-slate-500">
              발주·구매에서 사용할 품목 정보를 등록합니다. 재고수량은 입고·출하·조정으로만 반영돼요.
            </p>
          </DialogHeader>
        </div>

        <div className="px-5 pt-3">
          <div className="flex border-b border-slate-200">
            <span className="border-b-2 border-indigo-600 px-3 py-2 text-xs font-semibold text-indigo-700">
              기본
            </span>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="item-code" className="text-xs text-slate-600">
              품목코드
            </Label>
            <Input
              id="item-code"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.code}
              onChange={(e) => setField("code", e.target.value)}
              placeholder="예: I007"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="item-name" className="text-xs text-slate-600">
              품목명
            </Label>
            <Input
              id="item-name"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="품목명"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="item-spec" className="text-xs text-slate-600">
              규격
            </Label>
            <Input
              id="item-spec"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.spec}
              onChange={(e) => setField("spec", e.target.value)}
              placeholder="규격 (선택)"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="item-unit" className="text-xs text-slate-600">
              단위
            </Label>
            <Input
              id="item-unit"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.unit}
              onChange={(e) => setField("unit", e.target.value)}
              placeholder="EA, 개 등 (선택)"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="item-min-stock" className="text-xs text-slate-600">
              안전재고
            </Label>
            <CommaNumberInput
              id="item-min-stock"
              className="h-9 rounded-lg border-slate-200 text-sm tabular-nums focus-visible:ring-indigo-500"
              value={form.minStock}
              onChange={(v) => setField("minStock", v)}
              placeholder="0"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="item-inbound" className="text-xs text-slate-600">
              입고단가
            </Label>
            <div className="flex items-center gap-3">
              <CommaNumberInput
                id="item-inbound"
                className="h-9 flex-1 rounded-lg border-slate-200 text-sm tabular-nums focus-visible:ring-indigo-500"
                value={form.inboundPrice}
                onChange={(v) => setField("inboundPrice", v)}
                placeholder="0"
              />
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={form.inboundVatIncluded}
                  onChange={(e) => setField("inboundVatIncluded", e.target.checked)}
                />
                VAT포함
              </label>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="item-outbound" className="text-xs text-slate-600">
              출고단가
            </Label>
            <div className="flex items-center gap-3">
              <CommaNumberInput
                id="item-outbound"
                className="h-9 flex-1 rounded-lg border-slate-200 text-sm tabular-nums focus-visible:ring-indigo-500"
                value={form.outboundPrice}
                onChange={(v) => setField("outboundPrice", v)}
                placeholder="0"
              />
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={form.outboundVatIncluded}
                  onChange={(e) => setField("outboundVatIncluded", e.target.checked)}
                />
                VAT포함
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-0 gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 sm:justify-end">
          <Button type="button" size="sm" className="h-8 min-w-[64px]" onClick={handleSave}>
            저장
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={handleReset}
          >
            다시 작성
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-slate-600"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      {appDialog}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  nextWarehouseCode,
  upsertWarehouse,
  type Warehouse,
} from "@/lib/warehouses";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (warehouse: Warehouse) => void;
};

type FormState = {
  code: string;
  name: string;
  memo: string;
};

function emptyForm(code = ""): FormState {
  return {
    code,
    name: "",
    memo: "",
  };
}

export function WarehouseRegisterDialog({ open, onOpenChange, onSaved }: Props) {
  const { alert: appAlert, dialog: appDialog } = useAppDialog();
  const [form, setForm] = useState<FormState>(() => emptyForm());

  useEffect(() => {
    if (open) void nextWarehouseCode().then((code) => setForm(emptyForm(code))).catch(() => setForm(emptyForm()));
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleReset() {
    try { setForm(emptyForm(await nextWarehouseCode())); } catch { setForm(emptyForm()); }
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      await appAlert({ title: "알림", description: "창고코드와 창고명은 필수입니다." });
      return;
    }
    const saved: Warehouse = {
      code: form.code.trim(),
      name: form.name.trim(),
      memo: form.memo.trim() || undefined,
    };
    try {
      const created = await upsertWarehouse(saved);
      onSaved(created);
      onOpenChange(false);
    } catch (error) {
      await appAlert({ title: "저장 실패", description: error instanceof Error ? error.message : "창고 저장에 실패했습니다." });
    }
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
            <DialogTitle className="text-base text-slate-900">창고 등록</DialogTitle>
            <p className="mt-1 text-xs text-slate-500">
              발주·구매에서 사용할 창고 정보를 등록합니다.
            </p>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="wh-code" className="text-xs text-slate-600">
              창고코드
            </Label>
            <Input
              id="wh-code"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.code}
              onChange={(e) => setField("code", e.target.value)}
              placeholder="예: W007"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wh-name" className="text-xs text-slate-600">
              창고명
            </Label>
            <Input
              id="wh-name"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="창고명"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wh-memo" className="text-xs text-slate-600">
              메모/적요
            </Label>
            <Input
              id="wh-memo"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.memo}
              onChange={(e) => setField("memo", e.target.value)}
              placeholder="위치·용도 등 (선택)"
            />
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

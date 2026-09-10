"use client";

import { useEffect, useState } from "react";
import {
  nextEmployeeCode,
  upsertEmployee,
  type Employee,
} from "@/lib/employees";
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
  onSaved: (employee: Employee) => void;
};

type FormState = {
  code: string;
  name: string;
  phone: string;
  email: string;
  memo: string;
};

function emptyForm(code = ""): FormState {
  return {
    code,
    name: "",
    phone: "",
    email: "",
    memo: "",
  };
}

export function EmployeeRegisterDialog({ open, onOpenChange, onSaved }: Props) {
  const { alert: appAlert, dialog: appDialog } = useAppDialog();
  const [form, setForm] = useState<FormState>(() => emptyForm());

  useEffect(() => {
    if (open) void nextEmployeeCode().then((code) => setForm(emptyForm(code))).catch(() => setForm(emptyForm()));
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleReset() {
    try { setForm(emptyForm(await nextEmployeeCode())); } catch { setForm(emptyForm()); }
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      await appAlert({ title: "알림", description: "사원코드와 사원명은 필수입니다." });
      return;
    }
    const saved: Employee = {
      code: form.code.trim(),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      memo: form.memo.trim() || undefined,
    };
    try {
      const created = await upsertEmployee(saved);
      onSaved(created);
      onOpenChange(false);
    } catch (error) {
      await appAlert({ title: "저장 실패", description: error instanceof Error ? error.message : "사원 저장에 실패했습니다." });
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
            <DialogTitle className="text-base text-slate-900">사원 등록</DialogTitle>
            <p className="mt-1 text-xs text-slate-500">
              담당자로 사용할 사원 정보를 등록합니다.
            </p>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="emp-code" className="text-xs text-slate-600">
              사원코드
            </Label>
            <Input
              id="emp-code"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.code}
              onChange={(e) => setField("code", e.target.value)}
              placeholder="예: E006"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-name" className="text-xs text-slate-600">
              사원명
            </Label>
            <Input
              id="emp-name"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="이름"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-phone" className="text-xs text-slate-600">
              연락처
            </Label>
            <Input
              id="emp-phone"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="010-0000-0000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-email" className="text-xs text-slate-600">
              이메일
            </Label>
            <Input
              id="emp-email"
              type="email"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="emp-memo" className="text-xs text-slate-600">
              메모
            </Label>
            <Input
              id="emp-memo"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.memo}
              onChange={(e) => setField("memo", e.target.value)}
              placeholder="부서·비고 등"
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

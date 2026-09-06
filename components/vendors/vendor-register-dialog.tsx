"use client";

import { useEffect, useState } from "react";
import {
  nextVendorCode,
  upsertVendor,
  type Vendor,
} from "@/lib/vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  onSaved: (vendor: Vendor) => void;
};

type FormState = {
  code: string;
  name: string;
  ceo: string;
  businessNo: string;
  phone: string;
  email: string;
  address: string;
  memo: string;
};

function emptyForm(): FormState {
  return {
    code: nextVendorCode(),
    name: "",
    ceo: "",
    businessNo: "",
    phone: "",
    email: "",
    address: "",
    memo: "",
  };
}

export function VendorRegisterDialog({ open, onOpenChange, onSaved }: Props) {
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

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      alert("거래처코드와 거래처명은 필수입니다.");
      return;
    }
    const saved: Vendor = {
      code: form.code.trim(),
      name: form.name.trim(),
      ceo: form.ceo.trim() || undefined,
      businessNo: form.businessNo.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      memo: form.memo.trim() || undefined,
    };
    upsertVendor(saved);
    onSaved(saved);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-2xl border-slate-200 p-0 shadow-xl"
        onClose={() => onOpenChange(false)}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 px-5 py-4 pr-12">
          <DialogHeader className="mb-0">
            <DialogTitle className="text-base text-slate-900">거래처 등록</DialogTitle>
            <p className="mt-1 text-xs text-slate-500">
              발주·구매에서 사용할 거래처 기본 정보를 등록합니다.
            </p>
          </DialogHeader>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-auto px-5 py-4 scrollbar-thin">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
            <p className="text-xs font-semibold text-indigo-700">기본</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vendor-code" className="text-xs text-slate-600">
              거래처코드
            </Label>
            <Input
              id="vendor-code"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.code}
              onChange={(e) => setField("code", e.target.value)}
              placeholder="예: V006"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vendor-name" className="text-xs text-slate-600">
              거래처명
            </Label>
            <Input
              id="vendor-name"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="거래처명"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vendor-ceo" className="text-xs text-slate-600">
              대표자
            </Label>
            <Input
              id="vendor-ceo"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.ceo}
              onChange={(e) => setField("ceo", e.target.value)}
              placeholder="대표자명"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vendor-bizno" className="text-xs text-slate-600">
              사업자번호
            </Label>
            <Input
              id="vendor-bizno"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.businessNo}
              onChange={(e) => setField("businessNo", e.target.value)}
              placeholder="000-00-00000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vendor-phone" className="text-xs text-slate-600">
              전화
            </Label>
            <Input
              id="vendor-phone"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="02-0000-0000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vendor-email" className="text-xs text-slate-600">
              이메일
            </Label>
            <Input
              id="vendor-email"
              type="email"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="contact@company.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vendor-address" className="text-xs text-slate-600">
              주소
            </Label>
            <Input
              id="vendor-address"
              className="h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              placeholder="사업장 주소"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vendor-memo" className="text-xs text-slate-600">
              메모
            </Label>
            <Textarea
              id="vendor-memo"
              className="min-h-[64px] rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500"
              value={form.memo}
              onChange={(e) => setField("memo", e.target.value)}
              placeholder="비고·메모 (선택)"
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
  );
}

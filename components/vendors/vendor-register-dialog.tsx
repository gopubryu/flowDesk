"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  nextVendorCode,
  upsertVendor,
  VENDOR_CODE_TYPE_OPTIONS,
  type Vendor,
  type VendorCodeType,
} from "@/lib/vendors";
import { Button } from "@/components/ui/button";
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
  onSaved: (vendor: Vendor) => void;
};

type FormState = {
  code: string;
  name: string;
  codeType: VendorCodeType;
  bizRegNo: string;
  ceo: string;
  businessType: string;
  businessItem: string;
  phone: string;
  fax: string;
  mobile: string;
  address: string;
  homepage: string;
  contactPerson: string;
  email: string;
};

type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  bname: string;
  apartment: string;
  userSelectedType: "R" | "J";
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        width?: string | number;
        height?: string | number;
      }) => { embed: (el: HTMLElement) => void };
    };
  }
}

const fieldCls =
  "h-9 rounded-lg border-slate-200 text-sm focus-visible:ring-indigo-500";

const DAUM_POSTCODE_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.daum?.Postcode) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${DAUM_POSTCODE_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("failed to load postcode")),
        { once: true }
      );
      return;
    }
    const script = document.createElement("script");
    script.src = DAUM_POSTCODE_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("failed to load postcode"));
    document.head.appendChild(script);
  });
}

function formatPostcodeAddress(data: DaumPostcodeData): string {
  const base =
    data.userSelectedType === "R"
      ? data.roadAddress || data.jibunAddress
      : data.jibunAddress || data.roadAddress;

  let extra = "";
  if (data.userSelectedType === "R") {
    if (data.bname && /[동로가]$/g.test(data.bname)) {
      extra += data.bname;
    }
    if (data.buildingName && data.apartment === "Y") {
      extra += extra ? `, ${data.buildingName}` : data.buildingName;
    } else if (data.buildingName) {
      extra += extra ? `, ${data.buildingName}` : data.buildingName;
    }
  } else if (data.buildingName) {
    extra = data.buildingName;
  }

  const full = extra ? `${base} (${extra})` : base;
  return `${data.zonecode} ${full}`.trim();
}

function emptyForm(): FormState {
  return {
    code: nextVendorCode(),
    name: "",
    codeType: "비사업자(내국인)",
    bizRegNo: "",
    ceo: "",
    businessType: "",
    businessItem: "",
    phone: "",
    fax: "",
    mobile: "",
    address: "",
    homepage: "",
    contactPerson: "",
    email: "",
  };
}

export function VendorRegisterDialog({ open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const postcodeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setPostcodeOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!postcodeOpen) return;

    let cancelled = false;

    (async () => {
      try {
        await loadDaumPostcode();
        if (cancelled || !postcodeContainerRef.current || !window.daum?.Postcode) {
          return;
        }
        postcodeContainerRef.current.innerHTML = "";
        new window.daum.Postcode({
          oncomplete: (data) => {
            setForm((f) => ({ ...f, address: formatPostcodeAddress(data) }));
            setPostcodeOpen(false);
          },
          width: "100%",
          height: "100%",
        }).embed(postcodeContainerRef.current);
      } catch {
        if (!cancelled) {
          alert("주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
          setPostcodeOpen(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postcodeOpen]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleReset() {
    setForm(emptyForm());
  }

  function handleRegisterOpenChange(next: boolean) {
    if (!next && postcodeOpen) {
      setPostcodeOpen(false);
      return;
    }
    onOpenChange(next);
  }

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      alert("거래처코드와 상호(이름)는 필수입니다.");
      return;
    }
    const saved: Vendor = {
      code: form.code.trim(),
      name: form.name.trim(),
      codeType: form.codeType,
      bizRegNo: form.bizRegNo.trim() || undefined,
      ceo: form.ceo.trim() || undefined,
      businessType: form.businessType.trim() || undefined,
      businessItem: form.businessItem.trim() || undefined,
      phone: form.phone.trim() || undefined,
      fax: form.fax.trim() || undefined,
      mobile: form.mobile.trim() || undefined,
      address: form.address.trim() || undefined,
      homepage: form.homepage.trim() || undefined,
      contactPerson: form.contactPerson.trim() || undefined,
      email: form.email.trim() || undefined,
    };
    upsertVendor(saved);
    onSaved(saved);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleRegisterOpenChange}>
        <DialogContent
          className="max-w-lg rounded-2xl border-slate-200 p-0 shadow-xl"
          onClose={() => handleRegisterOpenChange(false)}
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
                className={fieldCls}
                value={form.code}
                onChange={(e) => setField("code", e.target.value)}
                placeholder="예: V006"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-name" className="text-xs text-slate-600">
                상호(이름)
              </Label>
              <Input
                id="vendor-name"
                className={fieldCls}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="상호명"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-code-type" className="text-xs text-slate-600">
                거래처코드구분
              </Label>
              <select
                id="vendor-code-type"
                className={`${fieldCls} w-full border bg-white px-3`}
                value={form.codeType}
                onChange={(e) =>
                  setField("codeType", e.target.value as VendorCodeType)
                }
              >
                {VENDOR_CODE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-biz-reg-no" className="text-xs text-slate-600">
                사업자등록번호
              </Label>
              <Input
                id="vendor-biz-reg-no"
                className={fieldCls}
                value={form.bizRegNo}
                onChange={(e) => setField("bizRegNo", e.target.value)}
                placeholder="000-00-00000"
                inputMode="numeric"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-ceo" className="text-xs text-slate-600">
                대표자명
              </Label>
              <Input
                id="vendor-ceo"
                className={fieldCls}
                value={form.ceo}
                onChange={(e) => setField("ceo", e.target.value)}
                placeholder="대표자명"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="vendor-biz-type" className="text-xs text-slate-600">
                  업태
                </Label>
                <Input
                  id="vendor-biz-type"
                  className={fieldCls}
                  value={form.businessType}
                  onChange={(e) => setField("businessType", e.target.value)}
                  placeholder="업태"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vendor-biz-item" className="text-xs text-slate-600">
                  종목
                </Label>
                <Input
                  id="vendor-biz-item"
                  className={fieldCls}
                  value={form.businessItem}
                  onChange={(e) => setField("businessItem", e.target.value)}
                  placeholder="종목"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="vendor-phone" className="text-xs text-slate-600">
                  전화
                </Label>
                <Input
                  id="vendor-phone"
                  className={fieldCls}
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="02-0000-0000"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vendor-fax" className="text-xs text-slate-600">
                  Fax
                </Label>
                <Input
                  id="vendor-fax"
                  className={fieldCls}
                  value={form.fax}
                  onChange={(e) => setField("fax", e.target.value)}
                  placeholder="02-0000-0000"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-mobile" className="text-xs text-slate-600">
                모바일
              </Label>
              <Input
                id="vendor-mobile"
                className={fieldCls}
                value={form.mobile}
                onChange={(e) => setField("mobile", e.target.value)}
                placeholder="010-0000-0000"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-address" className="text-xs text-slate-600">
                주소
              </Label>
              <div className="flex gap-2">
                <Input
                  id="vendor-address"
                  className={`${fieldCls} min-w-0 flex-1`}
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="주소검색으로 입력하거나 직접 입력"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 border-indigo-200 px-3 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => setPostcodeOpen(true)}
                >
                  주소검색
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-homepage" className="text-xs text-slate-600">
                홈페이지
              </Label>
              <Input
                id="vendor-homepage"
                className={fieldCls}
                value={form.homepage}
                onChange={(e) => setField("homepage", e.target.value)}
                placeholder="https://"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-contact" className="text-xs text-slate-600">
                담당자
              </Label>
              <Input
                id="vendor-contact"
                className={fieldCls}
                value={form.contactPerson}
                onChange={(e) => setField("contactPerson", e.target.value)}
                placeholder="담당자명"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-email" className="text-xs text-slate-600">
                Email
              </Label>
              <Input
                id="vendor-email"
                type="email"
                className={fieldCls}
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="contact@company.com"
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

      {postcodeOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPostcodeOpen(false)}
            aria-hidden
          />
          <div className="pointer-events-none relative z-[100] mx-4 flex w-full justify-center">
            <div
              className="pointer-events-auto relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl"
              role="dialog"
              aria-modal="true"
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 h-8 w-8"
                onClick={() => setPostcodeOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">닫기</span>
              </Button>
              <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 px-5 py-4 pr-12">
                <DialogHeader className="mb-0">
                  <DialogTitle className="text-base text-slate-900">주소 검색</DialogTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    도로명 또는 지번으로 주소를 검색하세요.
                  </p>
                </DialogHeader>
              </div>
              <div
                ref={postcodeContainerRef}
                className="w-full overflow-hidden bg-white"
                style={{ height: 400 }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

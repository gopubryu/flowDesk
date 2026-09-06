export type VendorCodeType =
  | "비사업자(내국인)"
  | "비사업자(외국인)";

export const VENDOR_CODE_TYPE_OPTIONS: VendorCodeType[] = [
  "비사업자(내국인)",
  "비사업자(외국인)",
];

export type Vendor = {
  code: string;
  /** 상호(이름) */
  name: string;
  /** 거래처코드구분 */
  codeType: VendorCodeType;
  /** 사업자등록번호 */
  bizRegNo?: string;
  /** 대표자명 */
  ceo?: string;
  /** 업태 */
  businessType?: string;
  /** 종목 */
  businessItem?: string;
  phone?: string;
  fax?: string;
  mobile?: string;
  address?: string;
  homepage?: string;
  /** 담당자 */
  contactPerson?: string;
  email?: string;
};

const STORAGE_KEY = "flowdesk-vendors";


function normalizeCodeType(value: unknown): VendorCodeType {
  const raw = String(value ?? "").trim();
  // migrate legacy labels (no parentheses)
  if (raw === "비사업자내국인" || raw === "비사업자(내국인)") return "비사업자(내국인)";
  if (raw === "비사업자외국인" || raw === "비사업자(외국인)") return "비사업자(외국인)";
  // old code-type option "사업자등록번호" -> default
  if (raw === "사업자등록번호") return "비사업자(내국인)";
  if (raw === "비사업자(내국인)" || raw === "비사업자(외국인)") {
    return raw;
  }
  return "비사업자(내국인)";
}



function withDefaults(
  row: Partial<Vendor> & Pick<Vendor, "code" | "name">
): Vendor {
  const codeType = normalizeCodeType(row.codeType);
  return {
    code: row.code,
    name: row.name,
    codeType,
    bizRegNo: row.bizRegNo?.trim() || undefined,
    ceo: row.ceo,
    businessType: row.businessType,
    businessItem: row.businessItem,
    phone: row.phone,
    fax: row.fax,
    mobile: row.mobile,
    address: row.address,
    homepage: row.homepage,
    contactPerson: row.contactPerson,
    email: row.email,
  };
}

/** Seed Korean mock vendors for 거래처 찾기 */
export const SEED_VENDORS: Vendor[] = [
  withDefaults({
    code: "V001",
    name: "한빛상사",
    codeType: "비사업자(내국인)",
    ceo: "김한빛",
    businessType: "도매 및 소매업",
    businessItem: "산업자재",
    phone: "02-1234-5678",
    fax: "02-1234-5679",
    mobile: "010-1234-5678",
    address: "서울특별시 강남구 테헤란로 100",
    homepage: "https://hanbit.local",
    contactPerson: "윤수진",
    email: "contact@hanbit.local",
  }),
  withDefaults({
    code: "V002",
    name: "동양부품",
    codeType: "비사업자(내국인)",
    ceo: "박동양",
    businessType: "제조업",
    businessItem: "기계부품",
    phone: "031-234-5678",
    mobile: "010-2345-6789",
    address: "경기도 성남시 분당구 판교로 200",
    contactPerson: "강민호",
    email: "sales@dongyang.local",
  }),
  withDefaults({
    code: "V003",
    name: "서울철강",
    codeType: "비사업자(내국인)",
    ceo: "이철강",
    businessType: "도매업",
    businessItem: "철강·금속",
    phone: "02-3456-7890",
    fax: "02-3456-7891",
    address: "서울특별시 영등포구 여의대로 24",
    contactPerson: "배서영",
    email: "order@seoulsteel.local",
  }),
  withDefaults({
    code: "V004",
    name: "부산포장재",
    codeType: "비사업자(내국인)",
    ceo: "최포장",
    businessType: "제조업",
    businessItem: "포장재",
    phone: "051-456-7890",
    mobile: "010-4567-8901",
    address: "부산광역시 사상구 낙동대로 1200",
    contactPerson: "조현우",
    email: "info@busanpack.local",
  }),
  withDefaults({
    code: "V005",
    name: "그린케미칼",
    codeType: "비사업자(내국인)",
    ceo: "정그린",
    businessType: "도매업",
    businessItem: "화학제품",
    phone: "032-567-8901",
    fax: "032-567-8902",
    mobile: "010-5678-9012",
    address: "인천광역시 남동구 남동대로 300",
    homepage: "https://greenchem.local",
    contactPerson: "한지우",
    email: "cs@greenchem.local",
  }),
];

export function loadVendors(): Vendor[] {
  if (typeof window === "undefined") return SEED_VENDORS.map((v) => ({ ...v }));
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveVendors(SEED_VENDORS);
      return SEED_VENDORS.map((v) => ({ ...v }));
    }
    const parsed = JSON.parse(raw) as Partial<Vendor>[];
    if (!Array.isArray(parsed)) return SEED_VENDORS.map((v) => ({ ...v }));
    return parsed
      .filter((r) => r && typeof r.code === "string" && typeof r.name === "string")
      .map((r) => withDefaults(r as Partial<Vendor> & Pick<Vendor, "code" | "name">));
  } catch {
    return SEED_VENDORS.map((v) => ({ ...v }));
  }
}

export function saveVendors(rows: Vendor[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function upsertVendor(row: Vendor): Vendor[] {
  const code = row.code.trim();
  const name = row.name.trim();
  if (!code || !name) return loadVendors();
  const next = loadVendors().filter(
    (v) => v.code.toLowerCase() !== code.toLowerCase()
  );
  next.unshift(
    withDefaults({
      code,
      name,
      codeType: row.codeType,
      ceo: row.ceo?.trim() || undefined,
      businessType: row.businessType?.trim() || undefined,
      businessItem: row.businessItem?.trim() || undefined,
      phone: row.phone?.trim() || undefined,
      fax: row.fax?.trim() || undefined,
      mobile: row.mobile?.trim() || undefined,
      address: row.address?.trim() || undefined,
      homepage: row.homepage?.trim() || undefined,
      contactPerson: row.contactPerson?.trim() || undefined,
      email: row.email?.trim() || undefined,
    })
  );
  saveVendors(next);
  return next;
}

export function nextVendorCode(): string {
  const rows = loadVendors();
  let max = 0;
  for (const r of rows) {
    const m = /^V(\d+)$/i.exec(r.code.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `V${String(max + 1).padStart(3, "0")}`;
}

export function searchVendors(query: string): Vendor[] {
  const q = query.trim().toLowerCase();
  const rows = loadVendors();
  if (!q) return rows;
  return rows.filter(
    (v) =>
      v.code.toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q) ||
      (v.ceo && v.ceo.toLowerCase().includes(q)) ||
      (v.phone && v.phone.includes(q)) ||
      (v.mobile && v.mobile.includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q)) ||
      (v.contactPerson && v.contactPerson.toLowerCase().includes(q))
  );
}

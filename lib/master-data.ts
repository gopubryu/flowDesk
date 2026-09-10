export const VENDOR_CODE_TYPE_OPTIONS = [
  "사업자등록번호",
  "비사업자(내국인)",
  "비사업자(외국인)",
] as const;
export type VendorCodeType = (typeof VENDOR_CODE_TYPE_OPTIONS)[number];

export type Employee = { code: string; name: string; phone?: string; email?: string; memo?: string };
export type Warehouse = { code: string; name: string; memo?: string };
export type Vendor = {
  code: string; name: string; codeType: VendorCodeType; bizRegNo?: string; ceo?: string;
  businessType?: string; businessItem?: string; phone?: string; fax?: string; mobile?: string;
  address?: string; homepage?: string; contactPerson?: string; email?: string;
};

export class MasterDataValidationError extends Error {}
const text = (value: unknown) => String(value ?? "").trim();
const optional = (value: unknown) => text(value) || null;
function required(value: unknown, label: string) {
  const result = text(value);
  if (!result) throw new MasterDataValidationError(`${label} is required`);
  return result;
}
function base(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new MasterDataValidationError("Invalid request body");
  const row = body as Record<string, unknown>;
  return { row, code: required(row.code, "code").toUpperCase(), name: required(row.name, "name") };
}
export function normalizeEmployee(body: unknown) {
  const { row, code, name } = base(body);
  return { code, name, phone: optional(row.phone), email: optional(row.email), memo: optional(row.memo) };
}
export function normalizeWarehouse(body: unknown) {
  const { row, code, name } = base(body);
  return { code, name, memo: optional(row.memo) };
}
export function normalizeVendor(body: unknown) {
  const { row, code, name } = base(body);
  const codeType = text(row.codeType);
  if (!VENDOR_CODE_TYPE_OPTIONS.includes(codeType as VendorCodeType)) throw new MasterDataValidationError("Invalid codeType");
  return {
    code, name, codeType: codeType as VendorCodeType, bizRegNo: optional(row.bizRegNo), ceo: optional(row.ceo),
    businessType: optional(row.businessType), businessItem: optional(row.businessItem), phone: optional(row.phone),
    fax: optional(row.fax), mobile: optional(row.mobile), address: optional(row.address), homepage: optional(row.homepage),
    contactPerson: optional(row.contactPerson), email: optional(row.email),
  };
}
export function nextCode(rows: { code: string }[], prefix: string) {
  const pattern = new RegExp(`^${prefix}(\\d+)$`, "i");
  const max = rows.reduce((value, row) => {
    const match = pattern.exec(row.code.trim());
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return `${prefix.toUpperCase()}${String(max + 1).padStart(3, "0")}`;
}

export const SEED_EMPLOYEES: Employee[] = [
  { code: "E001", name: "김민수", phone: "010-1234-5678", email: "minsu.kim@flowdesk.local", memo: "구매팀" },
  { code: "E002", name: "이서연", phone: "010-2345-6789", email: "seoyeon.lee@flowdesk.local", memo: "영업팀" },
  { code: "E003", name: "박지훈", phone: "010-3456-7890", email: "jihoon.park@flowdesk.local", memo: "물류팀" },
  { code: "E004", name: "최유진", phone: "010-4567-8901", email: "yujin.choi@flowdesk.local", memo: "경영지원" },
  { code: "E005", name: "정하늘", phone: "010-5678-9012", email: "haneul.jung@flowdesk.local", memo: "생산관리" },
];
export const SEED_WAREHOUSES: Warehouse[] = [
  { code: "W001", name: "본사창고", memo: "서울 본사" }, { code: "W002", name: "판교물류센터", memo: "경기 성남" },
  { code: "W003", name: "부산항창고", memo: "부산 남구" }, { code: "W004", name: "인천보세창고", memo: "인천 중구" },
  { code: "W005", name: "대구지점창고", memo: "대구 달서" }, { code: "W006", name: "원자재창고", memo: "생산용" },
];
export const SEED_VENDORS: Vendor[] = [
  { code: "V001", name: "한빛상사", codeType: "비사업자(내국인)", ceo: "김한빛", businessType: "도매 및 소매업", businessItem: "산업자재", phone: "02-1234-5678", fax: "02-1234-5679", mobile: "010-1234-5678", address: "서울특별시 강남구 테헤란로 100", homepage: "https://hanbit.local", contactPerson: "윤수진", email: "contact@hanbit.local" },
  { code: "V002", name: "동양부품", codeType: "비사업자(내국인)", ceo: "박동양", businessType: "제조업", businessItem: "기계부품", phone: "031-234-5678", mobile: "010-2345-6789", address: "경기도 성남시 분당구 판교로 200", contactPerson: "강민호", email: "sales@dongyang.local" },
  { code: "V003", name: "서울철강", codeType: "비사업자(내국인)", ceo: "이철강", businessType: "도매업", businessItem: "철강·금속", phone: "02-3456-7890", fax: "02-3456-7891", address: "서울특별시 영등포구 여의대로 24", contactPerson: "배서영", email: "order@seoulsteel.local" },
  { code: "V004", name: "부산포장재", codeType: "비사업자(내국인)", ceo: "최포장", businessType: "제조업", businessItem: "포장재", phone: "051-456-7890", mobile: "010-4567-8901", address: "부산광역시 사상구 낙동대로 1200", contactPerson: "조현우", email: "info@busanpack.local" },
  { code: "V005", name: "그린케미칼", codeType: "비사업자(내국인)", ceo: "정그린", businessType: "도매업", businessItem: "화학제품", phone: "032-567-8901", fax: "032-567-8902", mobile: "010-5678-9012", address: "인천광역시 남동구 남동대로 300", homepage: "https://greenchem.local", contactPerson: "한지우", email: "cs@greenchem.local" },
];

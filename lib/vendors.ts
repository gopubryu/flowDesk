export type Vendor = {
  code: string;
  name: string;
  /** 대표자 */
  ceo?: string;
  /** 사업자번호 */
  businessNo?: string;
  phone?: string;
  email?: string;
  address?: string;
  memo?: string;
};

const STORAGE_KEY = "flowdesk-vendors";

/** Seed Korean mock vendors for 거래처 찾기 */
export const SEED_VENDORS: Vendor[] = [
  {
    code: "V001",
    name: "한빛상사",
    ceo: "김한빛",
    businessNo: "123-45-67890",
    phone: "02-1234-5678",
    email: "contact@hanbit.local",
    address: "서울특별시 강남구 테헤란로 100",
    memo: "주요 원자재 공급",
  },
  {
    code: "V002",
    name: "동양부품",
    ceo: "박동양",
    businessNo: "234-56-78901",
    phone: "031-234-5678",
    email: "sales@dongyang.local",
    address: "경기도 성남시 분당구 판교로 200",
    memo: "볼트·너트",
  },
  {
    code: "V003",
    name: "서울철강",
    ceo: "이철강",
    businessNo: "345-67-89012",
    phone: "02-3456-7890",
    email: "order@seoulsteel.local",
    address: "서울특별시 영등포구 여의대로 24",
    memo: "판재·형강",
  },
  {
    code: "V004",
    name: "부산포장재",
    ceo: "최포장",
    businessNo: "456-78-90123",
    phone: "051-456-7890",
    email: "info@busanpack.local",
    address: "부산광역시 사상구 낙동대로 1200",
    memo: "골판지·완충재",
  },
  {
    code: "V005",
    name: "그린케미칼",
    ceo: "정그린",
    businessNo: "567-89-01234",
    phone: "032-567-8901",
    email: "cs@greenchem.local",
    address: "인천광역시 남동구 남동대로 300",
    memo: "윤활유·세제",
  },
];

export function loadVendors(): Vendor[] {
  if (typeof window === "undefined") return [...SEED_VENDORS];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveVendors(SEED_VENDORS);
      return [...SEED_VENDORS];
    }
    const parsed = JSON.parse(raw) as Vendor[];
    return Array.isArray(parsed) ? parsed : [...SEED_VENDORS];
  } catch {
    return [...SEED_VENDORS];
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
  next.unshift({
    code,
    name,
    ceo: row.ceo?.trim() || undefined,
    businessNo: row.businessNo?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    email: row.email?.trim() || undefined,
    address: row.address?.trim() || undefined,
    memo: row.memo?.trim() || undefined,
  });
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
      (v.businessNo && v.businessNo.includes(q)) ||
      (v.phone && v.phone.includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q))
  );
}

export type Employee = {
  code: string;
  name: string;
  phone?: string;
  email?: string;
  memo?: string;
};

const STORAGE_KEY = "flowdesk-employees";

/** Seed Korean mock employees for 담당자 / 사원 찾기 */
export const SEED_EMPLOYEES: Employee[] = [
  {
    code: "E001",
    name: "김민수",
    phone: "010-1234-5678",
    email: "minsu.kim@flowdesk.local",
    memo: "구매팀",
  },
  {
    code: "E002",
    name: "이서연",
    phone: "010-2345-6789",
    email: "seoyeon.lee@flowdesk.local",
    memo: "영업팀",
  },
  {
    code: "E003",
    name: "박지훈",
    phone: "010-3456-7890",
    email: "jihoon.park@flowdesk.local",
    memo: "물류팀",
  },
  {
    code: "E004",
    name: "최유진",
    phone: "010-4567-8901",
    email: "yujin.choi@flowdesk.local",
    memo: "경영지원",
  },
  {
    code: "E005",
    name: "정하늘",
    phone: "010-5678-9012",
    email: "haneul.jung@flowdesk.local",
    memo: "생산관리",
  },
];

export function loadEmployees(): Employee[] {
  if (typeof window === "undefined") return [...SEED_EMPLOYEES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveEmployees(SEED_EMPLOYEES);
      return [...SEED_EMPLOYEES];
    }
    const parsed = JSON.parse(raw) as Employee[];
    return Array.isArray(parsed) ? parsed : [...SEED_EMPLOYEES];
  } catch {
    return [...SEED_EMPLOYEES];
  }
}

export function saveEmployees(rows: Employee[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function upsertEmployee(row: Employee): Employee[] {
  const code = row.code.trim();
  const name = row.name.trim();
  if (!code || !name) return loadEmployees();
  const next = loadEmployees().filter(
    (e) => e.code.toLowerCase() !== code.toLowerCase()
  );
  next.unshift({
    code,
    name,
    phone: row.phone?.trim() || undefined,
    email: row.email?.trim() || undefined,
    memo: row.memo?.trim() || undefined,
  });
  saveEmployees(next);
  return next;
}

export function nextEmployeeCode(): string {
  const rows = loadEmployees();
  let max = 0;
  for (const r of rows) {
    const m = /^E(\d+)$/i.exec(r.code.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `E${String(max + 1).padStart(3, "0")}`;
}

export function searchEmployees(query: string): Employee[] {
  const q = query.trim().toLowerCase();
  const rows = loadEmployees();
  if (!q) return rows;
  return rows.filter(
    (e) =>
      e.code.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      (e.phone && e.phone.includes(q)) ||
      (e.email && e.email.toLowerCase().includes(q))
  );
}

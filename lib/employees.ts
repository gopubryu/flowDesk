import { masterDataRequest } from "./master-data-client";
import { nextCode, type Employee } from "./master-data";
export type { Employee } from "./master-data";
export { SEED_EMPLOYEES } from "./master-data";
export const loadEmployees = () => masterDataRequest<Employee[]>("/api/employees");
export const createEmployee = (row: Employee) => masterDataRequest<Employee>("/api/employees", { method: "POST", body: JSON.stringify(row) });
export const updateEmployee = (code: string, row: Employee) => masterDataRequest<Employee>(`/api/employees/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(row) });
export const deleteEmployee = (code: string) => masterDataRequest<{ ok: true }>(`/api/employees/${encodeURIComponent(code)}`, { method: "DELETE" });
export async function upsertEmployee(row: Employee) { return createEmployee(row); }
export async function nextEmployeeCode() { return nextCode(await loadEmployees(), "E"); }
export async function searchEmployees(query: string) { const q=query.trim().toLowerCase(); const rows=await loadEmployees(); return q ? rows.filter(e => [e.code,e.name,e.phone,e.email,e.memo].some(v => v?.toLowerCase().includes(q))) : rows; }

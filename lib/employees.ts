import { activeWorkspaceId, masterDataRequest } from "./master-data-client";
import { nextCode, type Employee } from "./master-data";
export type { Employee } from "./master-data";
export { SEED_EMPLOYEES } from "./master-data";
export async function loadEmployees() { const id = await activeWorkspaceId(); return masterDataRequest<Employee[]>(`/api/employees?workspaceId=${encodeURIComponent(id)}`); }
export async function createEmployee(row: Employee) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<Employee>("/api/employees", { method: "POST", body: JSON.stringify({ ...row, workspaceId }) }); }
export async function updateEmployee(code: string, row: Employee) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<Employee>(`/api/employees/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify({ ...row, workspaceId }) }); }
export async function deleteEmployee(code: string) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<{ ok: true }>(`/api/employees/${encodeURIComponent(code)}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" }); }
export async function upsertEmployee(row: Employee) { return createEmployee(row); }
export async function nextEmployeeCode() { return nextCode(await loadEmployees(), "E"); }
export async function searchEmployees(query: string) { const q=query.trim().toLowerCase(); const rows=await loadEmployees(); return q ? rows.filter(e => [e.code,e.name,e.phone,e.email,e.memo].some(v => v?.toLowerCase().includes(q))) : rows; }

import { activeWorkspaceId, masterDataRequest } from "./master-data-client";
import { nextCode, type Department } from "./master-data";
export type { Department } from "./master-data";
export async function loadDepartments() { const id = await activeWorkspaceId(); return masterDataRequest<Department[]>(`/api/departments?workspaceId=${encodeURIComponent(id)}`); }
export async function createDepartment(row: Department) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<Department>("/api/departments", { method: "POST", body: JSON.stringify({ ...row, workspaceId }) }); }
export async function updateDepartment(code: string, row: Department) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<Department>(`/api/departments/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify({ ...row, workspaceId }) }); }
export async function deleteDepartment(code: string) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<{ ok: true }>(`/api/departments/${encodeURIComponent(code)}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" }); }
export async function nextDepartmentCode() { return nextCode(await loadDepartments(), "D"); }

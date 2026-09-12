import { masterDataRequest } from "./master-data-client";
import { nextCode, type Department } from "./master-data";
export type { Department } from "./master-data";
export const loadDepartments = () => masterDataRequest<Department[]>("/api/departments");
export const createDepartment = (row: Department) => masterDataRequest<Department>("/api/departments", { method: "POST", body: JSON.stringify(row) });
export const updateDepartment = (code: string, row: Department) => masterDataRequest<Department>(`/api/departments/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(row) });
export const deleteDepartment = (code: string) => masterDataRequest<{ ok: true }>(`/api/departments/${encodeURIComponent(code)}`, { method: "DELETE" });
export async function nextDepartmentCode() { return nextCode(await loadDepartments(), "D"); }

import { activeWorkspaceId, masterDataRequest } from "./master-data-client";
import { nextCode, type Warehouse } from "./master-data";
export type { Warehouse } from "./master-data";
export { SEED_WAREHOUSES } from "./master-data";
export async function loadWarehouses() { const id = await activeWorkspaceId(); return masterDataRequest<Warehouse[]>(`/api/warehouses?workspaceId=${encodeURIComponent(id)}`); }
export async function createWarehouse(row: Warehouse) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<Warehouse>("/api/warehouses", { method: "POST", body: JSON.stringify({ ...row, workspaceId }) }); }
export async function updateWarehouse(code: string, row: Warehouse) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<Warehouse>(`/api/warehouses/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify({ ...row, workspaceId }) }); }
export async function deleteWarehouse(code: string) { const workspaceId = await activeWorkspaceId(); return masterDataRequest<{ ok: true }>(`/api/warehouses/${encodeURIComponent(code)}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" }); }
export async function upsertWarehouse(row: Warehouse) { return createWarehouse(row); }
export async function nextWarehouseCode() { return nextCode(await loadWarehouses(), "W"); }
export async function searchWarehouses(query: string) { const q=query.trim().toLowerCase(); const rows=await loadWarehouses(); return q ? rows.filter(w => [w.code,w.name,w.memo].some(v => v?.toLowerCase().includes(q))) : rows; }

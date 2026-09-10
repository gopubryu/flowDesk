import { masterDataRequest } from "./master-data-client";
import { nextCode, type Warehouse } from "./master-data";
export type { Warehouse } from "./master-data";
export { SEED_WAREHOUSES } from "./master-data";
export const loadWarehouses = () => masterDataRequest<Warehouse[]>("/api/warehouses");
export const createWarehouse = (row: Warehouse) => masterDataRequest<Warehouse>("/api/warehouses", { method: "POST", body: JSON.stringify(row) });
export const updateWarehouse = (code: string, row: Warehouse) => masterDataRequest<Warehouse>(`/api/warehouses/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(row) });
export const deleteWarehouse = (code: string) => masterDataRequest<{ ok: true }>(`/api/warehouses/${encodeURIComponent(code)}`, { method: "DELETE" });
export async function upsertWarehouse(row: Warehouse) { return createWarehouse(row); }
export async function nextWarehouseCode() { return nextCode(await loadWarehouses(), "W"); }
export async function searchWarehouses(query: string) { const q=query.trim().toLowerCase(); const rows=await loadWarehouses(); return q ? rows.filter(w => [w.code,w.name,w.memo].some(v => v?.toLowerCase().includes(q))) : rows; }

import { masterDataRequest } from "./master-data-client";
import { nextCode, type Item } from "./master-data";
export type { Item } from "./master-data";
export const loadItems = () => masterDataRequest<Item[]>("/api/items");
export const createItem = (row: Item) => masterDataRequest<Item>("/api/items", { method: "POST", body: JSON.stringify(row) });
export const updateItem = (code: string, row: Item) => masterDataRequest<Item>(`/api/items/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(row) });
export const deleteItem = (code: string) => masterDataRequest<{ ok: true }>(`/api/items/${encodeURIComponent(code)}`, { method: "DELETE" });
export async function nextItemCode() { return nextCode(await loadItems(), "I"); }
export async function searchItems(query: string) { const normalized = query.trim().toLowerCase(); const rows = await loadItems(); return normalized ? rows.filter((item) => [item.code, item.name, item.spec, item.unit].some((value) => value?.toLowerCase().includes(normalized))) : rows; }

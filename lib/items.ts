import { masterDataRequest } from "./master-data-client";
import { nextCode, type Item } from "./master-data";
export type { Item } from "./master-data";

const LEGACY_STORAGE_KEY = "flowdesk-items";

type WorkspaceMembershipResponse = { memberships: Array<{ workspace: { id: string } }> };

async function activeWorkspaceId() {
  const { memberships } = await masterDataRequest<WorkspaceMembershipResponse>("/api/auth/workspaces");
  if (memberships.length !== 1) {
    throw new Error("품목을 사용하려면 활성 업무 공간을 선택해야 합니다.");
  }
  return memberships[0].workspace.id;
}

function legacyItems(): Item[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((row): row is Item => Boolean(row && typeof row === "object" && typeof (row as Item).code === "string" && typeof (row as Item).name === "string")) : [];
  } catch { return []; }
}

export async function createItem(row: Item) {
  const workspaceId = await activeWorkspaceId();
  return masterDataRequest<Item>("/api/items", { method: "POST", body: JSON.stringify({ ...row, workspaceId }) });
}
export async function updateItem(code: string, row: Item) {
  const workspaceId = await activeWorkspaceId();
  return masterDataRequest<Item>(`/api/items/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify({ ...row, workspaceId }) });
}
export async function deleteItem(code: string) {
  const workspaceId = await activeWorkspaceId();
  return masterDataRequest<{ ok: true }>(`/api/items/${encodeURIComponent(code)}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
}

/** Migrates legacy browser-only rows once, retaining the source on any failure. */
export async function loadItems() {
  const workspaceId = await activeWorkspaceId();
  let rows = await masterDataRequest<Item[]>(`/api/items?workspaceId=${encodeURIComponent(workspaceId)}`);
  const legacy = legacyItems();
  const missing = legacy.filter((row) => !rows.some((saved) => saved.code.toUpperCase() === row.code.trim().toUpperCase()));
  if (!missing.length) return rows;
  try {
    await Promise.all(missing.map(createItem));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    rows = await masterDataRequest<Item[]>(`/api/items?workspaceId=${encodeURIComponent(workspaceId)}`);
  } catch {
    // Do not delete browser data unless every unsynced row was accepted by the server.
  }
  return rows;
}

export async function nextItemCode() { return nextCode(await loadItems(), "I"); }
export async function searchItems(query: string) { const normalized = query.trim().toLowerCase(); const rows = await loadItems(); return normalized ? rows.filter((item) => [item.code, item.name, item.spec, item.unit].some((value) => value?.toLowerCase().includes(normalized))) : rows; }

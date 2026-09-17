import { normalizeItem, SEED_ITEMS } from "./master-data";

export type ItemData = ReturnType<typeof normalizeItem>;
export type ItemWorkspaceWhere = { workspaceId: string };
export type ItemWorkspaceCreate = ItemData & { workspaceId: string };

export function buildItemWorkspaceWhere(workspaceId: string): ItemWorkspaceWhere {
  return { workspaceId };
}

export function buildSeedItemData(workspaceId: string): ItemWorkspaceCreate[] {
  return SEED_ITEMS.map(normalizeItem).map((row) => ({ ...row, workspaceId }));
}

export function buildItemCreateData(data: ItemData, workspaceId: string): ItemWorkspaceCreate {
  return { ...data, workspaceId };
}

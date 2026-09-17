import { buildItemCreateData, buildItemWorkspaceWhere, buildSeedItemData, type ItemData, type ItemWorkspaceCreate, type ItemWorkspaceWhere } from "./items-query";

type ItemDb = {
  item: {
    count(args: { where: ItemWorkspaceWhere }): Promise<number>;
    createMany(args: { data: ItemWorkspaceCreate[]; skipDuplicates: boolean }): Promise<unknown>;
    findMany(args: { where: ItemWorkspaceWhere; orderBy: { code: "asc" } }): Promise<Record<string, unknown>[]>;
    create(args: { data: ItemWorkspaceCreate }): Promise<Record<string, unknown>>;
  };
};

export async function listItemsForWorkspace(db: ItemDb, workspaceId: string) {
  const where = buildItemWorkspaceWhere(workspaceId);
  if (await db.item.count({ where }) === 0) {
    await db.item.createMany({ data: buildSeedItemData(workspaceId), skipDuplicates: true });
  }
  return db.item.findMany({ where, orderBy: { code: "asc" } });
}

export function createItemForWorkspace(db: ItemDb, data: ItemData, workspaceId: string) {
  return db.item.create({ data: buildItemCreateData(data, workspaceId) });
}

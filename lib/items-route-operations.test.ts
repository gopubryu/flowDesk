import assert from "node:assert/strict";
import test from "node:test";
import { createItemForWorkspace, listItemsForWorkspace } from "./items-route-operations";

const item = {
  code: "I999",
  name: "Test item",
  spec: null,
  unit: null,
  minStock: 0,
  inboundPrice: 10,
  inboundVatIncluded: false,
  outboundPrice: 20,
  outboundVatIncluded: false,
};

function mockDb(count: number) {
  const calls: Array<{ method: string; args: unknown }> = [];
  const db = {
    item: {
      async count(args: unknown) { calls.push({ method: "count", args }); return count; },
      async createMany(args: unknown) { calls.push({ method: "createMany", args }); return {}; },
      async findMany(args: unknown) { calls.push({ method: "findMany", args }); return []; },
      async create(args: unknown) { calls.push({ method: "create", args }); return args as Record<string, unknown>; },
    },
  };
  return { db, calls };
}

test("items list orchestration shares one workspace where and scopes seed rows", async () => {
  const { db, calls } = mockDb(0);
  await listItemsForWorkspace(db, "workspace-a");
  const count = calls.find((call) => call.method === "count")?.args as { where: unknown };
  const seed = calls.find((call) => call.method === "createMany")?.args as { data: Array<{ workspaceId: string }> };
  const find = calls.find((call) => call.method === "findMany")?.args as { where: unknown };
  assert.deepEqual(count.where, { workspaceId: "workspace-a" });
  assert.deepEqual(find.where, count.where);
  assert.equal(seed.data.every((row) => row.workspaceId === "workspace-a"), true);
});

test("items create orchestration sends only builder-scoped data to Prisma", async () => {
  const { db, calls } = mockDb(1);
  await createItemForWorkspace(db, item, "workspace-b");
  const args = calls.find((call) => call.method === "create")?.args as { data: Record<string, unknown> };
  assert.deepEqual(args.data, { ...item, workspaceId: "workspace-b" });
  assert.equal(Object.hasOwn(args.data, "tenantId"), false);
});

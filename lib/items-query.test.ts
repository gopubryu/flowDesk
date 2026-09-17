import assert from "node:assert/strict";
import test from "node:test";
import { buildItemCreateData, buildItemWorkspaceWhere, buildSeedItemData } from "./items-query";

test("item read scope builder returns the authenticated workspace exactly", () => {
  assert.deepEqual(buildItemWorkspaceWhere("workspace-a"), { workspaceId: "workspace-a" });
});

test("item seed and create builders put the authenticated workspace in every row", () => {
  const seed = buildSeedItemData("workspace-a");
  assert.ok(seed.length > 0);
  assert.equal(seed.every((row) => row.workspaceId === "workspace-a"), true);

  const data = {
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
  assert.deepEqual(buildItemCreateData(data, "workspace-b"), { ...data, workspaceId: "workspace-b" });
});

test("item builders reject the two known workspace-scope mutants", () => {
  const data = {
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
  const created = buildItemCreateData(data, "workspace-b");
  assert.equal(created.workspaceId, "workspace-b");
  assert.equal(Object.hasOwn(created, "tenantId"), false);
  assert.deepEqual(buildItemWorkspaceWhere("workspace-a"), { workspaceId: "workspace-a" });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInventoryLookup,
  mergeInventoryRows,
  type InventoryLookupRow,
} from "./purchase-request-inventory";

test("builds a deduplicated lookup for current item codes and warehouse", () => {
  assert.deepEqual(
    buildInventoryLookup([" A-01 ", "", "A-01", "B-02"], " WH-01 "),
    { itemCodes: ["A-01", "B-02"], warehouseCode: "WH-01" }
  );
});

test("merges total stock and selected warehouse stock without mutating lines", () => {
  const rows: InventoryLookupRow[] = [
    { itemCode: "A-01", warehouseCode: "WH-01", qty: 3 },
    { itemCode: "A-01", warehouseCode: "WH-02", qty: 7 },
    { itemCode: "B-02", warehouseCode: "WH-01", qty: 0 },
  ];
  const lines = [{ itemCode: "A-01" }, { itemCode: "B-02" }, { itemCode: "C-03" }];

  assert.deepEqual(mergeInventoryRows(lines, rows, "WH-01"), [
    { totalStock: 10, warehouseStock: 3 },
    { totalStock: 0, warehouseStock: 0 },
    { totalStock: 0, warehouseStock: 0 },
  ]);
});

test("returns an empty lookup when no warehouse or item codes are selected", () => {
  assert.deepEqual(buildInventoryLookup(["A-01"], ""), { itemCodes: [], warehouseCode: "" });
  assert.deepEqual(buildInventoryLookup([], "WH-01"), { itemCodes: [], warehouseCode: "WH-01" });
});

test("fetchBalances accepts itemCodes for one inventory request", async () => {
  const originalFetch = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    if (requested === "/api/auth/workspaces") {
      return new Response(JSON.stringify({ memberships: [{ workspace: { id: "workspace-1" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const { fetchBalances } = await import("./inventory");
    await fetchBalances({ itemCodes: ["A-01", "B-02"], warehouseCode: "WH-01" });
    assert.equal(requested, "/api/inventory/balances?workspaceId=workspace-1&warehouseCode=WH-01&itemCodes=A-01%2CB-02");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

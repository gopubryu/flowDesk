import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost/test";

const itemDb = {
  item: {
    findMany: async ({ where }: { where: { workspaceId: string; code: { in: string[] } } }) =>
      where.code.in.includes("I001") ? [{ code: "I001" }] : [],
  },
};

test("registered item validation accepts a known workspace item code", async () => {
  const { validateRegisteredItemCodes } = await import("./inventory-server");
  assert.equal(await validateRegisteredItemCodes(["I001"], "workspace-1", itemDb), null);
});

test("registered item validation rejects an unknown workspace item code", async () => {
  const { validateRegisteredItemCodes } = await import("./inventory-server");
  assert.equal(
    await validateRegisteredItemCodes(["I001", "NOT-A-REAL-ITEM"], "workspace-1", itemDb),
    "Unknown item code NOT-A-REAL-ITEM."
  );
});

test("synthetic NAME item codes keep the existing validation error", async () => {
  const { assertMasterItemCode } = await import("./inventory-server");
  assert.equal(
    assertMasterItemCode("NAME:legacy item"),
    "품목코드에 이름 대체값(NAME:…)을 쓸 수 없어요. 마스터 품목코드를 입력해 주세요."
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { canDelete, canWrite, type UiWorkspaceRole } from "./workspace-permissions";

test("VIEWER cannot write or delete", () => {
  assert.equal(canWrite("VIEWER"), false);
  assert.equal(canDelete("VIEWER"), false);
});

test("OPERATOR can write but not delete", () => {
  assert.equal(canWrite("OPERATOR"), true);
  assert.equal(canDelete("OPERATOR"), false);
});

test("ADMIN can write and delete", () => {
  assert.equal(canWrite("ADMIN"), true);
  assert.equal(canDelete("ADMIN"), true);
});

test("unknown or missing role is treated as read-only", () => {
  const unknown = null as unknown as UiWorkspaceRole | null;
  assert.equal(canWrite(unknown), false);
  assert.equal(canDelete(unknown), false);
});

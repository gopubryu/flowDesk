import assert from "node:assert/strict";
import test from "node:test";
import { canAccessWorkspaceRole } from "./workspace-auth-rules";
import { WorkspaceRole } from "@prisma/client";

test("workspace role authorization requires an active membership", () => {
  assert.equal(
    canAccessWorkspaceRole(
      { isActive: true, role: WorkspaceRole.ADMIN },
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR],
    ),
    true,
  );
  assert.equal(
    canAccessWorkspaceRole(
      { isActive: true, role: WorkspaceRole.VIEWER },
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR],
    ),
    false,
  );
  assert.equal(
    canAccessWorkspaceRole(
      { isActive: false, role: WorkspaceRole.ADMIN },
      [WorkspaceRole.ADMIN],
    ),
    false,
  );
  assert.equal(canAccessWorkspaceRole(null, [WorkspaceRole.ADMIN]), false);
});

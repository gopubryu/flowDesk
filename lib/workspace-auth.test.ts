import assert from "node:assert/strict";
import test from "node:test";
import { canAccessWorkspaceRole, canCreateFirstWorkspace, validateWorkspaceName } from "./workspace-auth-rules";
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

test("workspace names are trimmed and must contain 1 to 100 characters", () => {
  assert.equal(validateWorkspaceName("  Acme  "), "Acme");
  assert.equal(validateWorkspaceName("   "), null);
  assert.equal(validateWorkspaceName("a".repeat(101)), null);
  assert.equal(validateWorkspaceName(42), null);
});

test("first-workspace onboarding is allowed only without an active membership", () => {
  assert.equal(canCreateFirstWorkspace(null), true);
  assert.equal(canCreateFirstWorkspace({ isActive: false }), true);
  assert.equal(canCreateFirstWorkspace({ isActive: true }), false);
});

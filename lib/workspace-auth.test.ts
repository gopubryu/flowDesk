import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessWorkspaceRole,
  canCreateFirstWorkspace,
  resolveWorkspaceSelection,
  validateWorkspaceName,
} from "./workspace-auth-rules";
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

test("workspace selection only falls back for exactly one active workspace", () => {
  assert.deepEqual(resolveWorkspaceSelection(" ws-2 ", ["ws-1"]), {
    kind: "explicit",
    workspaceId: "ws-2",
  });
  assert.deepEqual(resolveWorkspaceSelection(undefined, ["ws-1"]), {
    kind: "compatibility-fallback",
    workspaceId: "ws-1",
  });
  assert.equal(resolveWorkspaceSelection(undefined, []).kind, "missing");
  assert.equal(resolveWorkspaceSelection(undefined, ["ws-1", "ws-2"]).kind, "ambiguous");
  assert.equal(resolveWorkspaceSelection("", ["ws-1", "ws-2"]).kind, "ambiguous");
});
test("first-workspace onboarding is allowed only without an active membership", () => {
  assert.equal(canCreateFirstWorkspace(null), true);
  assert.equal(canCreateFirstWorkspace({ isActive: false }), true);
  assert.equal(canCreateFirstWorkspace({ isActive: true }), false);
});

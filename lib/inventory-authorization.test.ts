import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceRole } from "@prisma/client";
import { canAccessWorkspaceRole, resolveWorkspaceSelection } from "./workspace-auth-rules";

test("inventory reads require an active member with a permitted role", () => {
  assert.equal(canAccessWorkspaceRole({ isActive: true, role: WorkspaceRole.VIEWER }, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]), true);
  assert.equal(canAccessWorkspaceRole({ isActive: false, role: WorkspaceRole.VIEWER }, [WorkspaceRole.VIEWER]), false);
  assert.equal(canAccessWorkspaceRole({ isActive: true, role: WorkspaceRole.VIEWER }, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]), false);
});

test("inventory writes permit only admin or operator roles", () => {
  assert.equal(canAccessWorkspaceRole({ isActive: true, role: WorkspaceRole.ADMIN }, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]), true);
  assert.equal(canAccessWorkspaceRole({ isActive: true, role: WorkspaceRole.OPERATOR }, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]), true);
  assert.equal(canAccessWorkspaceRole({ isActive: true, role: WorkspaceRole.VIEWER }, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]), false);
});

test("workspace selection falls back only for one active membership and rejects ambiguity", () => {
  assert.deepEqual(resolveWorkspaceSelection(undefined, ["workspace-a"]), { kind: "compatibility-fallback", workspaceId: "workspace-a" });
  assert.deepEqual(resolveWorkspaceSelection(undefined, ["workspace-a", "workspace-b"]), { kind: "ambiguous" });
  assert.deepEqual(resolveWorkspaceSelection(" workspace-b ", ["workspace-a"]), { kind: "explicit", workspaceId: "workspace-b" });
});

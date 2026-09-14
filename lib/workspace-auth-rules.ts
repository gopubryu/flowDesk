import { WorkspaceRole, type WorkspaceMember } from "@prisma/client";

const MAX_WORKSPACE_NAME_LENGTH = 100;

export function validateWorkspaceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 && name.length <= MAX_WORKSPACE_NAME_LENGTH ? name : null;
}

export function canCreateFirstWorkspace(
  membership: Pick<WorkspaceMember, "isActive"> | null,
): boolean {
  return !membership?.isActive;
}

export function isWorkspaceRoleAllowed(
  role: WorkspaceRole,
  allowedRoles: readonly WorkspaceRole[],
): boolean {
  return allowedRoles.includes(role);
}

export function canAccessWorkspaceRole(
  membership: Pick<WorkspaceMember, "isActive" | "role"> | null,
  allowedRoles: readonly WorkspaceRole[],
): boolean {
  return Boolean(
    membership?.isActive && isWorkspaceRoleAllowed(membership.role, allowedRoles),
  );
}

export type WorkspaceResolution =
  | { kind: "explicit"; workspaceId: string }
  | { kind: "compatibility-fallback"; workspaceId: string }
  | { kind: "missing" }
  | { kind: "ambiguous" };

/**
 * Selects a workspace candidate without authorizing it. Callers must pass the
 * selected id through requireWorkspaceRole before using it for any data query.
 */
export function resolveWorkspaceSelection(
  explicitWorkspaceId: unknown,
  activeWorkspaceIds: readonly string[],
): WorkspaceResolution {
  if (typeof explicitWorkspaceId === "string" && explicitWorkspaceId.trim()) {
    return { kind: "explicit", workspaceId: explicitWorkspaceId.trim() };
  }
  if (activeWorkspaceIds.length === 1) {
    return { kind: "compatibility-fallback", workspaceId: activeWorkspaceIds[0] };
  }
  return activeWorkspaceIds.length === 0 ? { kind: "missing" } : { kind: "ambiguous" };
}

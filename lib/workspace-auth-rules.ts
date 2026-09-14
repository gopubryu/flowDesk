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

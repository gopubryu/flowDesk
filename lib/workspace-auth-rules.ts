import { WorkspaceRole, type WorkspaceMember } from "@prisma/client";

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

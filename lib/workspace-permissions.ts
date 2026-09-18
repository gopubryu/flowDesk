export type UiWorkspaceRole = "ADMIN" | "OPERATOR" | "VIEWER";

const WRITE_ROLES: readonly UiWorkspaceRole[] = ["ADMIN", "OPERATOR"];
const DELETE_ROLES: readonly UiWorkspaceRole[] = ["ADMIN"];

export function canWrite(role: UiWorkspaceRole | null | undefined): boolean {
  return role ? WRITE_ROLES.includes(role) : false;
}

export function canDelete(role: UiWorkspaceRole | null | undefined): boolean {
  return role ? DELETE_ROLES.includes(role) : false;
}

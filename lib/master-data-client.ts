import { clientJson } from "./client-request";

type WorkspaceMembershipResponse = { memberships: Array<{ workspace: { id: string } }> };

export async function activeWorkspaceId() {
  const { memberships } = await masterDataRequest<WorkspaceMembershipResponse>("/api/auth/workspaces");
  if (memberships.length !== 1) throw new Error("사용하려면 활성 업무 공간을 선택해야 합니다.");
  return memberships[0].workspace.id;
}

export async function masterDataRequest<T>(url: string, init?: RequestInit): Promise<T> {
  return clientJson<T>(url, init);
}

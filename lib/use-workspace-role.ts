"use client";

import { useEffect, useState } from "react";
import { masterDataRequest } from "@/lib/master-data-client";
import { canDelete, canWrite, type UiWorkspaceRole } from "@/lib/workspace-permissions";

type MembershipResponse = { memberships: Array<{ workspace: { id: string; name?: string }; role: UiWorkspaceRole }> };

export interface WorkspaceRoleState {
  role: UiWorkspaceRole | null;
  workspaceId: string | null;
  loading: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export function useWorkspaceRole(): WorkspaceRoleState {
  const [role, setRole] = useState<UiWorkspaceRole | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    masterDataRequest<MembershipResponse>("/api/auth/workspaces")
      .then((data) => {
        if (cancelled) return;
        const current = data.memberships[0] ?? null;
        setRole(current?.role ?? null);
        setWorkspaceId(current?.workspace.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setRole(null);
          setWorkspaceId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { role, workspaceId, loading, canWrite: canWrite(role), canDelete: canDelete(role) };
}

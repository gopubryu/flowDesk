import { WorkspaceRole } from "@prisma/client";
import type { AuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-guards";
import {
  canAccessWorkspaceRole,
  isWorkspaceRoleAllowed,
} from "@/lib/workspace-auth-rules";

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getCurrentUserSession(): Promise<AuthSession | null> {
  return getServerSession();
}

export async function requireSessionUser() {
  const session = await getCurrentUserSession();
  if (!session) {
    throw new UnauthorizedError();
  }

  return { session, user: session.user };
}

export { canAccessWorkspaceRole, isWorkspaceRoleAllowed } from "@/lib/workspace-auth-rules";
export { WorkspaceRole };

export async function requireWorkspaceRole(
  workspaceId: string,
  allowedRoles: readonly WorkspaceRole[],
) {
  const { session, user } = await requireSessionUser();
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id,
      },
    },
  });

  // Deliberately use the same response for a missing/inactive membership and
  // a role mismatch so callers cannot probe workspace membership or existence.
  if (!canAccessWorkspaceRole(membership, allowedRoles)) {
    throw new ForbiddenError();
  }

  return { session, user, membership };
}

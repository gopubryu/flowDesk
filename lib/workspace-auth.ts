import { WorkspaceRole } from "@prisma/client";
import type { AuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-guards";
import {
  canAccessWorkspaceRole,
  isWorkspaceRoleAllowed,
  resolveWorkspaceSelection,
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

export class BadRequestError extends Error {
  readonly status = 400;

  constructor(message = "Bad request") {
    super(message);
    this.name = "BadRequestError";
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

/** Resolve a requested workspace, then authorize it before callers query data. */
export async function requireResolvedWorkspace(
  explicitWorkspaceId: unknown,
  allowedRoles: readonly WorkspaceRole[],
) {
  if (explicitWorkspaceId !== undefined && explicitWorkspaceId !== null && typeof explicitWorkspaceId !== "string") {
    throw new BadRequestError("workspaceId must be a string");
  }

  const explicit = typeof explicitWorkspaceId === "string" ? explicitWorkspaceId.trim() : undefined;
  if (explicit) {
    const authorized = await requireWorkspaceRole(explicit, allowedRoles);
    return { ...authorized, workspaceId: explicit };
  }

  const { user } = await requireSessionUser();
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id, isActive: true },
    select: { workspaceId: true },
    orderBy: { createdAt: "asc" },
  });
  const selection = resolveWorkspaceSelection(undefined, memberships.map(({ workspaceId }) => workspaceId));
  if (selection.kind === "ambiguous") {
    throw new BadRequestError("workspaceId is required when the user has multiple active workspaces");
  }
  if (selection.kind === "missing") {
    throw new ForbiddenError();
  }
  const authorized = await requireWorkspaceRole(selection.workspaceId, allowedRoles);
  return { ...authorized, workspaceId: selection.workspaceId };
}

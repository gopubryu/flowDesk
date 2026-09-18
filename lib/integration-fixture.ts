import type { PrismaClient, WorkspaceRole as WorkspaceRoleType } from "@prisma/client";
import { combineIntegrationErrors } from "./integration-cleanup";

export interface IntegrationUser {
  id: string;
  name: string;
  email: string;
}

export interface WorkspaceFixture {
  suffix: string;
  workspaceA: { id: string };
  workspaceB: { id: string };
  admin: IntegrationUser;
  operator: IntegrationUser;
  viewer: IntegrationUser;
}

export function integrationSession(user: IntegrationUser) {
  const now = new Date();
  return {
    user: { ...user, emailVerified: true, createdAt: now, updatedAt: now },
    session: {
      id: `session-${user.id}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      token: `token-${user.id}`,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function integrationRequest(url: string, init?: RequestInit) {
  return new Request(`http://integration.invalid${url}`, init);
}

export function uniqueCode(prefix: string, suffix: string) {
  return `${prefix}${suffix.slice(-8).toUpperCase()}`;
}

/**
 * Creates two isolated workspaces with ADMIN/OPERATOR/VIEWER members in workspace A,
 * runs the body, and always tears the fixture down. A cleanup failure never hides the
 * body's original assertion error (see combineIntegrationErrors).
 */
export async function withWorkspaceFixture(
  prisma: PrismaClient,
  WorkspaceRole: typeof WorkspaceRoleType,
  body: (fixture: WorkspaceFixture) => Promise<void>,
): Promise<void> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date();
  const makeUser = (kind: string, role: string) =>
    prisma.user.create({
      data: {
        id: `it-${kind}-${suffix}`,
        name: `Integration ${role}`,
        email: `${kind}-${suffix}@test.invalid`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    });

  const workspaceA = await prisma.workspace.create({ data: { name: `integration-a-${suffix}` } });
  const workspaceB = await prisma.workspace.create({ data: { name: `integration-b-${suffix}` } });
  const admin = await makeUser("admin", "Admin");
  const operator = await makeUser("operator", "Operator");
  const viewer = await makeUser("viewer", "Viewer");
  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId: workspaceA.id, userId: admin.id, role: WorkspaceRole.ADMIN },
      { workspaceId: workspaceA.id, userId: operator.id, role: WorkspaceRole.OPERATOR },
      { workspaceId: workspaceA.id, userId: viewer.id, role: WorkspaceRole.VIEWER },
    ],
  });

  let primaryError: unknown;
  try {
    await body({ suffix, workspaceA, workspaceB, admin, operator, viewer });
  } catch (error) {
    primaryError = error;
  } finally {
    const cleanupErrors: unknown[] = [];
    try {
      await prisma.workspace.deleteMany({ where: { id: { in: [workspaceA.id, workspaceB.id] } } });
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await prisma.user.deleteMany({ where: { id: { in: [admin.id, operator.id, viewer.id] } } });
    } catch (error) {
      cleanupErrors.push(error);
    }
    const finalError = combineIntegrationErrors(primaryError, cleanupErrors);
    if (finalError) throw finalError;
  }
}

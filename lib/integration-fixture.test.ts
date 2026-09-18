import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { withWorkspaceFixture } from "./integration-fixture";

const WorkspaceRole = { ADMIN: "ADMIN", OPERATOR: "OPERATOR", VIEWER: "VIEWER" } as const;

test("fixture setup failure cleans up resources created before the failure", async () => {
  const setupError = new Error("operator creation failed");
  const deletedWorkspaces: string[][] = [];
  const deletedUsers: string[][] = [];
  let userCreateCount = 0;
  let workspaceCreateCount = 0;
  const prisma = {
    workspace: {
      create: async () => {
        workspaceCreateCount += 1;
        return { id: `workspace-${workspaceCreateCount}` };
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        deletedWorkspaces.push(where.id.in);
        return { count: where.id.in.length };
      },
    },
    user: {
      create: async () => {
        userCreateCount += 1;
        if (userCreateCount === 2) throw setupError;
        return { id: "admin-id" };
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        deletedUsers.push(where.id.in);
        return { count: where.id.in.length };
      },
    },
    workspaceMember: { createMany: async () => ({ count: 3 }) },
  } as unknown as PrismaClient;

  await assert.rejects(
    withWorkspaceFixture(prisma, WorkspaceRole, async () => {
      throw new Error("body should not run after setup failure");
    }),
    (error: unknown) => error === setupError,
  );
  assert.deepEqual(deletedWorkspaces, [["workspace-1", "workspace-2"]]);
  assert.deepEqual(deletedUsers, [["admin-id"]]);
});

test("fixture body failure remains primary while setup resources are cleaned", async () => {
  const bodyError = new Error("body assertion failed");
  const deletedWorkspaces: string[][] = [];
  const deletedUsers: string[][] = [];
  const createdUserIds: string[] = [];
  let workspaceCreateCount = 0;
  const prisma = {
    workspace: {
      create: async () => {
        workspaceCreateCount += 1;
        return { id: `workspace-${workspaceCreateCount}` };
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        deletedWorkspaces.push(where.id.in);
        return { count: where.id.in.length };
      },
    },
    user: {
      create: async ({ data }: { data: { id: string } }) => {
        createdUserIds.push(data.id);
        return { id: data.id };
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        deletedUsers.push(where.id.in);
        return { count: where.id.in.length };
      },
    },
    workspaceMember: { createMany: async () => ({ count: 3 }) },
  } as unknown as PrismaClient;

  await assert.rejects(withWorkspaceFixture(prisma, WorkspaceRole, async () => { throw bodyError; }), (error: unknown) => error === bodyError);
  assert.deepEqual(deletedWorkspaces, [["workspace-1", "workspace-2"]]);
  assert.deepEqual(deletedUsers, [createdUserIds]);
});

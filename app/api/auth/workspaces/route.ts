import { NextResponse } from "next/server";
import { Prisma, WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, UnauthorizedError } from "@/lib/workspace-auth";
import {
  canCreateFirstWorkspace,
  validateWorkspaceName,
} from "@/lib/workspace-auth-rules";

export async function GET() {
  try {
    const { user } = await requireSessionUser();
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      memberships: memberships.map(({ role, workspace }) => ({
        workspace,
        role,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSessionUser();
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const workspaceName = validateWorkspaceName(
      typeof body === "object" && body !== null && "name" in body
        ? (body as { name?: unknown }).name
        : undefined,
    );
    if (!workspaceName) {
      return NextResponse.json(
        { error: "Workspace name must be between 1 and 100 characters" },
        { status: 400 },
      );
    }

    const workspace = await prisma.$transaction(
      async (transaction) => {
        const existingMembership = await transaction.workspaceMember.findFirst({
          where: { userId: user.id, isActive: true },
          select: { isActive: true },
        });
        if (!canCreateFirstWorkspace(existingMembership)) {
          return null;
        }

        return transaction.workspace.create({
          data: {
            name: workspaceName,
            members: {
              create: {
                userId: user.id,
                role: WorkspaceRole.ADMIN,
                isActive: true,
              },
            },
          },
          select: { id: true, name: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace onboarding has already been completed" },
        { status: 409 },
      );
    }

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
}

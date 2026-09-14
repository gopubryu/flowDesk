import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, UnauthorizedError } from "@/lib/workspace-auth";
import {
  hashInvitationToken,
  isInvitationEligible,
  isInvitationEmailMatch,
  isValidInvitationToken,
} from "@/lib/invitation";

function requestField(body: unknown, field: string): unknown {
  return typeof body === "object" && body !== null && field in body
    ? (body as Record<string, unknown>)[field]
    : undefined;
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireSessionUser>>["user"];
  try {
    ({ user } = await requireSessionUser());
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = requestField(body, "token");
  if (!isValidInvitationToken(token)) {
    return NextResponse.json({ error: "A valid invitation token is required" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const now = new Date();
        const invitation = await transaction.invitation.findFirst({
          where: {
            tokenHash: hashInvitationToken(token),
            acceptedAt: null,
            expiresAt: { gt: now },
          },
          select: {
            id: true,
            email: true,
            role: true,
            acceptedAt: true,
            expiresAt: true,
            workspace: { select: { id: true, name: true } },
          },
        });

        if (!invitation || !isInvitationEligible(invitation)) {
          return { kind: "not_found" as const };
        }
        if (!isInvitationEmailMatch(invitation.email, user.email)) {
          return { kind: "email_mismatch" as const };
        }

        const membership = await transaction.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: invitation.workspace.id,
              userId: user.id,
            },
          },
          select: { isActive: true },
        });

        if (membership?.isActive) {
          return { kind: "already_active" as const };
        }

        if (membership) {
          await transaction.workspaceMember.update({
            where: {
              workspaceId_userId: {
                workspaceId: invitation.workspace.id,
                userId: user.id,
              },
            },
            data: { role: invitation.role, isActive: true },
          });
        } else {
          await transaction.workspaceMember.create({
            data: {
              workspaceId: invitation.workspace.id,
              userId: user.id,
              role: invitation.role,
              isActive: true,
            },
          });
        }

        await transaction.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        return {
          kind: "accepted" as const,
          workspace: invitation.workspace,
          role: invitation.role,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Invalid, expired, or used invitation" }, { status: 404 });
    }
    if (result.kind === "email_mismatch") {
      return NextResponse.json({ error: "Invitation email does not match the signed-in user" }, { status: 403 });
    }
    if (result.kind === "already_active") {
      return NextResponse.json({ error: "User is already an active workspace member" }, { status: 409 });
    }

    return NextResponse.json({
      workspace: result.workspace,
      role: result.role,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "Invitation acceptance conflicted with another request" }, { status: 409 });
    }
    throw error;
  }
}

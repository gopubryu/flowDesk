import { NextResponse } from "next/server";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  UnauthorizedError,
  requireWorkspaceRole,
} from "@/lib/workspace-auth";
import {
  canInviteRole,
  createInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_MS,
  normalizeInvitationEmail,
  validateInvitationExpiry,
} from "@/lib/invitation";

const DELIVERY_NOTICE =
  "Invitation acceptance delivery is blocked because no email provider is configured.";

async function deliverInvitationEmail(input: { email: string; workspaceName: string; token: string; expiresAt: Date }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!apiKey || !from || !baseUrl) return { status: "not_configured" as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `${input.workspaceName} 업무 공간 초대`,
      text: `${input.workspaceName} 업무 공간에 초대되었습니다.\n\n초대 수락: ${baseUrl}/invitations/accept?token=${encodeURIComponent(input.token)}\n\n초대 만료: ${input.expiresAt.toISOString()}`,
    }),
  });
  if (!response.ok) return { status: "failed" as const };
  return { status: "sent" as const };
}

function requestField(body: unknown, field: string): unknown {
  return typeof body === "object" && body !== null && field in body
    ? (body as Record<string, unknown>)[field]
    : undefined;
}

function serializeInvitation(invitation: {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

export async function GET(request: Request) {
  try {
    const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    await requireWorkspaceRole(workspaceId, [WorkspaceRole.ADMIN]);
    const invitations = await prisma.invitation.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const workspaceId = requestField(body, "workspaceId");
    if (typeof workspaceId !== "string" || !workspaceId.trim()) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const { user, membership } = await requireWorkspaceRole(workspaceId.trim(), [WorkspaceRole.ADMIN]);
    const email = normalizeInvitationEmail(requestField(body, "email"));
    if (!email) {
      return NextResponse.json({ error: "A valid recipient email is required" }, { status: 400 });
    }

    const role = requestField(body, "role");
    if (!membership || !canInviteRole(membership.role, role)) {
      return NextResponse.json({ error: "Invalid invitation role" }, { status: 400 });
    }

    const requestedExpiry = requestField(body, "expiresAt");
    const expiresAt = requestedExpiry === undefined
      ? new Date(Date.now() + INVITATION_TTL_MS)
      : validateInvitationExpiry(requestedExpiry);
    if (!expiresAt) {
      return NextResponse.json({ error: "expiresAt must be a future date within 30 days" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const membership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspaceId.trim(), userId: existingUser.id } },
        select: { isActive: true },
      });
      if (membership?.isActive) {
        return NextResponse.json({ error: "User is already an active workspace member" }, { status: 409 });
      }
    }

    const pending = await prisma.invitation.findFirst({
      where: { workspaceId: workspaceId.trim(), email, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pending) {
      return NextResponse.json({ error: "A pending invitation already exists for this email" }, { status: 409 });
    }

    const token = createInvitationToken();
    const invitation = await prisma.invitation.create({
      data: {
        workspaceId: workspaceId.trim(),
        inviterId: user.id,
        email,
        role,
        tokenHash: hashInvitationToken(token),
        expiresAt,
      },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId.trim() }, select: { name: true } });
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const delivery = await deliverInvitationEmail({ email, workspaceName: workspace.name, token, expiresAt });
    if (delivery.status === "failed") {
      return NextResponse.json({
        invitation: serializeInvitation(invitation),
        delivery: "failed",
        deliveryMessage: "초대는 생성됐지만 이메일 발송에 실패했습니다.",
      }, { status: 502 });
    }

    return NextResponse.json({
      invitation: serializeInvitation(invitation),
      delivery: delivery.status,
      ...(delivery.status === "not_configured" ? { deliveryMessage: DELIVERY_NOTICE } : {}),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
}

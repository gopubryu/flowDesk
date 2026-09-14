import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, UnauthorizedError } from "@/lib/workspace-auth";

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

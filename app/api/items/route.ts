import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeItem, SEED_ITEMS } from "@/lib/master-data";
import { apiError, publicRow } from "@/lib/master-data-server";
import {
  BadRequestError,
  ForbiddenError,
  requireResolvedWorkspace,
  UnauthorizedError,
  WorkspaceRole,
} from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (error instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
  return null;
}

export async function GET(req: Request) {
  try {
    // Temporary compatibility: requireResolvedWorkspace permits omission only
    // when the authenticated user has exactly one active membership.
    const workspace = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER],
    );
    const workspaceId = workspace.workspaceId;
    if (await prisma.item.count({ where: { workspaceId } }) === 0) {
      await prisma.item.createMany({
        data: SEED_ITEMS.map(normalizeItem).map((row) => ({ ...row, workspaceId })),
        skipDuplicates: true,
      });
    }
    const rows = await prisma.item.findMany({ where: { workspaceId }, orderBy: { code: "asc" } });
    return NextResponse.json(rows.map(publicRow));
  } catch (error) {
    return authError(error) ?? apiError(error, "Failed to load items");
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const workspaceId = body && typeof body === "object" && !Array.isArray(body) && "workspaceId" in body
      ? (body as { workspaceId?: unknown }).workspaceId
      : undefined;
    if (typeof workspaceId !== "string" || !workspaceId.trim()) {
      throw new BadRequestError("workspaceId is required");
    }
    const workspace = await requireResolvedWorkspace(workspaceId, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const data = normalizeItem(body);
    const row = await prisma.item.create({ data: { ...data, workspaceId: workspace.workspaceId } });
    return NextResponse.json(publicRow(row), { status: 201 });
  } catch (error) {
    return authError(error) ?? apiError(error, "Failed to create item");
  }
}

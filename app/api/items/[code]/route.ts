import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeItem } from "@/lib/master-data";
import { assertMasterCanDelete, assertMasterCanRename } from "@/lib/master-data-references";
import { apiError, publicRow } from "@/lib/master-data-server";
import {
  BadRequestError,
  ForbiddenError,
  requireResolvedWorkspace,
  UnauthorizedError,
  WorkspaceRole,
} from "@/lib/workspace-auth";

type Ctx = { params: Promise<{ code: string }> };

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (error instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
  return null;
}

async function requestedWorkspace(req: Request, body?: unknown) {
  const fromBody = body && typeof body === "object" && !Array.isArray(body) && "workspaceId" in body
    ? (body as { workspaceId?: unknown }).workspaceId
    : undefined;
  return requireResolvedWorkspace(
    fromBody ?? new URL(req.url).searchParams.get("workspaceId"),
    [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR],
  );
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const body: unknown = await req.json();
    const workspace = await requestedWorkspace(req, body);
    const { code } = await ctx.params;
    const oldCode = decodeURIComponent(code).toUpperCase();
    const workspaceId = workspace.workspaceId;
    const existing = await prisma.item.findUnique({ where: { workspaceId_code: { workspaceId, code: oldCode } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = normalizeItem(body);
    await assertMasterCanRename("item", workspaceId, oldCode, data.code);
    const row = await prisma.item.update({ where: { id: existing.id }, data });
    return NextResponse.json(publicRow(row));
  } catch (error) {
    return authError(error) ?? apiError(error, "Failed to update item");
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const requestedWorkspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!requestedWorkspaceId?.trim()) throw new BadRequestError("workspaceId is required");
    const workspace = await requireResolvedWorkspace(
      requestedWorkspaceId,
      [WorkspaceRole.ADMIN],
    );
    const { code } = await ctx.params;
    const itemCode = decodeURIComponent(code).toUpperCase();
    const workspaceId = workspace.workspaceId;
    const existing = await prisma.item.findUnique({ where: { workspaceId_code: { workspaceId, code: itemCode } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertMasterCanDelete("item", workspaceId, itemCode);
    await prisma.item.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error) ?? apiError(error, "Failed to delete item");
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDepartment } from "@/lib/master-data";
import { assertMasterCanDelete, assertMasterCanRename } from "@/lib/master-data-references";
import { apiError, authError, bodyWorkspaceId, publicRow } from "@/lib/master-data-server";
import { BadRequestError, requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

type Ctx = { params: Promise<{ code: string }> };
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const body: unknown = await req.json();
    const workspace = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const { code } = await ctx.params; const oldCode = decodeURIComponent(code).toUpperCase();
    const existing = await prisma.department.findUnique({ where: { workspaceId_code: { workspaceId: workspace.workspaceId, code: oldCode } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = normalizeDepartment(body); await assertMasterCanRename("department", workspace.workspaceId, oldCode, data.code);
    const row = await prisma.department.update({ where: { id: existing.id }, data }); return NextResponse.json(publicRow(row));
  } catch (error) { return authError(error) ?? apiError(error, "Failed to update department"); }
}
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspaceId"); if (!workspaceId?.trim()) throw new BadRequestError("workspaceId is required");
    const workspace = await requireResolvedWorkspace(workspaceId, [WorkspaceRole.ADMIN]);
    const { code } = await ctx.params; const departmentCode = decodeURIComponent(code).toUpperCase();
    const existing = await prisma.department.findUnique({ where: { workspaceId_code: { workspaceId: workspace.workspaceId, code: departmentCode } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertMasterCanDelete("department", workspace.workspaceId, departmentCode); await prisma.department.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) { return authError(error) ?? apiError(error, "Failed to delete department"); }
}

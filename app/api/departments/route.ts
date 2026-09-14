import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDepartment } from "@/lib/master-data";
import { apiError, authError, bodyWorkspaceId, publicRow } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const workspace = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const rows = await prisma.department.findMany({ where: { workspaceId: workspace.workspaceId }, orderBy: { code: "asc" } });
    return NextResponse.json(rows.map(publicRow));
  } catch (error) { return authError(error) ?? apiError(error, "Failed to load departments"); }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const workspace = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const row = await prisma.department.create({ data: { ...normalizeDepartment(body), workspaceId: workspace.workspaceId } });
    return NextResponse.json(publicRow(row), { status: 201 });
  } catch (error) { return authError(error) ?? apiError(error, "Failed to create department"); }
}

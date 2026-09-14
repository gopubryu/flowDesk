import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeWarehouse, SEED_WAREHOUSES } from "@/lib/master-data";
import { apiError, authError, bodyWorkspaceId, publicRow } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const workspace = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const { workspaceId } = workspace;
    if (await prisma.warehouse.count({ where: { workspaceId } }) === 0) {
      await prisma.warehouse.createMany({ data: SEED_WAREHOUSES.map(normalizeWarehouse).map((row) => ({ ...row, workspaceId })), skipDuplicates: true });
    }
    const rows = await prisma.warehouse.findMany({ where: { workspaceId }, orderBy: { code: "asc" } });
    return NextResponse.json(rows.map(publicRow));
  } catch (error) { return authError(error) ?? apiError(error, "Failed to load warehouses"); }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const workspace = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const row = await prisma.warehouse.create({ data: { ...normalizeWarehouse(body), workspaceId: workspace.workspaceId } });
    return NextResponse.json(publicRow(row), { status: 201 });
  } catch (error) { return authError(error) ?? apiError(error, "Failed to create warehouse"); }
}

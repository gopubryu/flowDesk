import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeVendor, SEED_VENDORS } from "@/lib/master-data";
import { apiError, authError, bodyWorkspaceId, publicRow } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const workspace = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const { workspaceId } = workspace;
    if (await prisma.vendor.count({ where: { workspaceId } }) === 0) {
      await prisma.vendor.createMany({ data: SEED_VENDORS.map(normalizeVendor).map((row) => ({ ...row, workspaceId })), skipDuplicates: true });
    }
    const rows = await prisma.vendor.findMany({ where: { workspaceId }, orderBy: { code: "asc" } });
    return NextResponse.json(rows.map(publicRow));
  } catch (error) { return authError(error) ?? apiError(error, "Failed to load vendors"); }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const workspace = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const row = await prisma.vendor.create({ data: { ...normalizeVendor(body), workspaceId: workspace.workspaceId } });
    return NextResponse.json(publicRow(row), { status: 201 });
  } catch (error) { return authError(error) ?? apiError(error, "Failed to create vendor"); }
}

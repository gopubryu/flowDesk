import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MasterDataValidationError, normalizeEmployee } from "@/lib/master-data";
import { assertMasterCanDelete, assertMasterCanRename } from "@/lib/master-data-references";
import { apiError, authError, bodyWorkspaceId, publicRow } from "@/lib/master-data-server";
import { BadRequestError, requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

type Ctx = { params: Promise<{ code: string }> };
async function employeeData(input: ReturnType<typeof normalizeEmployee>, workspaceId: string) {
  const { departmentCode, ...data } = input;
  if (!departmentCode) return { ...data, departmentId: null };
  const department = await prisma.department.findUnique({ where: { workspaceId_code: { workspaceId, code: departmentCode } } });
  if (!department) throw new MasterDataValidationError("Department not found");
  return { ...data, departmentId: department.id };
}
function rowWithDepartment(row: { department: { code: string; name: string } | null } & Record<string, unknown>) {
  const { department, ...employee } = row;
  return { ...publicRow(employee), departmentCode: department?.code, departmentName: department?.name };
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const body: unknown = await req.json();
    const workspace = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const { code } = await ctx.params; const oldCode = decodeURIComponent(code).toUpperCase();
    const existing = await prisma.employee.findUnique({ where: { workspaceId_code: { workspaceId: workspace.workspaceId, code: oldCode } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = normalizeEmployee(body); await assertMasterCanRename("employee", workspace.workspaceId, oldCode, data.code);
    const row = await prisma.employee.update({ where: { id: existing.id }, data: await employeeData(data, workspace.workspaceId), include: { department: true } });
    return NextResponse.json(rowWithDepartment(row));
  } catch (error) { return authError(error) ?? apiError(error, "Failed to update employee"); }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspaceId"); if (!workspaceId?.trim()) throw new BadRequestError("workspaceId is required");
    const workspace = await requireResolvedWorkspace(workspaceId, [WorkspaceRole.ADMIN]);
    const { code } = await ctx.params; const employeeCode = decodeURIComponent(code).toUpperCase();
    const existing = await prisma.employee.findUnique({ where: { workspaceId_code: { workspaceId: workspace.workspaceId, code: employeeCode } } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertMasterCanDelete("employee", workspace.workspaceId, employeeCode); await prisma.employee.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) { return authError(error) ?? apiError(error, "Failed to delete employee"); }
}

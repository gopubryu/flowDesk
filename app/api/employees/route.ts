import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MasterDataValidationError, normalizeEmployee, SEED_EMPLOYEES } from "@/lib/master-data";
import { apiError, authError, bodyWorkspaceId, publicRow } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

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

export async function GET(req: Request) {
  try {
    const workspace = await requireResolvedWorkspace(new URL(req.url).searchParams.get("workspaceId"), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]);
    const { workspaceId } = workspace;
    if (await prisma.employee.count({ where: { workspaceId } }) === 0) {
      await prisma.employee.createMany({ data: await Promise.all(SEED_EMPLOYEES.map(async (seed) => ({ ...(await employeeData(normalizeEmployee(seed), workspaceId)), workspaceId }))), skipDuplicates: true });
    }
    const rows = await prisma.employee.findMany({ where: { workspaceId }, include: { department: true }, orderBy: { code: "asc" } });
    return NextResponse.json(rows.map(rowWithDepartment));
  } catch (error) { return authError(error) ?? apiError(error, "Failed to load employees"); }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const workspace = await requireResolvedWorkspace(bodyWorkspaceId(body), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const row = await prisma.employee.create({ data: { ...(await employeeData(normalizeEmployee(body), workspace.workspaceId)), workspaceId: workspace.workspaceId }, include: { department: true } });
    return NextResponse.json(rowWithDepartment(row), { status: 201 });
  } catch (error) { return authError(error) ?? apiError(error, "Failed to create employee"); }
}

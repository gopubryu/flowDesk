import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, ensureDemoWorkspace } from "@/lib/demo";
import { MasterDataValidationError, normalizeEmployee, SEED_EMPLOYEES } from "@/lib/master-data";
import { apiError, publicRow } from "@/lib/master-data-server";
export const dynamic = "force-dynamic";

async function employeeData(input: ReturnType<typeof normalizeEmployee>) {
  const { departmentCode, ...data } = input;
  if (!departmentCode) return { ...data, departmentId: null };
  const department = await prisma.department.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: departmentCode } } });
  if (!department) throw new MasterDataValidationError("Department not found");
  return { ...data, departmentId: department.id };
}
function rowWithDepartment(row: { department: { code: string; name: string } | null } & Record<string, unknown>) {
  if (!row) return row;
  const { department, ...employee } = row;
  return { ...publicRow(employee), departmentCode: department?.code, departmentName: department?.name };
}
export async function GET() { try { await ensureDemoWorkspace(); if (await prisma.employee.count({ where: { workspaceId: DEMO_WORKSPACE_ID } }) === 0) await prisma.employee.createMany({ data: SEED_EMPLOYEES.map(normalizeEmployee).map(({ departmentCode: _departmentCode, ...row }) => ({ ...row, workspaceId: DEMO_WORKSPACE_ID })), skipDuplicates: true }); const rows = await prisma.employee.findMany({ where: { workspaceId: DEMO_WORKSPACE_ID }, include: { department: true }, orderBy: { code: "asc" } }); return NextResponse.json(rows.map(rowWithDepartment)); } catch (error) { return apiError(error, "Failed to load employees"); } }
export async function POST(req: Request) { try { await ensureDemoWorkspace(); const data = await employeeData(normalizeEmployee(await req.json())); const row = await prisma.employee.create({ data: { ...data, workspaceId: DEMO_WORKSPACE_ID }, include: { department: true } }); return NextResponse.json(rowWithDepartment(row), { status: 201 }); } catch (error) { return apiError(error, "Failed to create employee"); } }

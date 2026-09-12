import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, ensureDemoWorkspace } from "@/lib/demo";
import { normalizeDepartment } from "@/lib/master-data";
import { apiError, publicRow } from "@/lib/master-data-server";
export const dynamic = "force-dynamic";
export async function GET() { try { await ensureDemoWorkspace(); const rows = await prisma.department.findMany({ where: { workspaceId: DEMO_WORKSPACE_ID }, orderBy: { code: "asc" } }); return NextResponse.json(rows.map(publicRow)); } catch (error) { return apiError(error, "Failed to load departments"); } }
export async function POST(req: Request) { try { await ensureDemoWorkspace(); const data = normalizeDepartment(await req.json()); const row = await prisma.department.create({ data: { ...data, workspaceId: DEMO_WORKSPACE_ID } }); return NextResponse.json(publicRow(row), { status: 201 }); } catch (error) { return apiError(error, "Failed to create department"); } }

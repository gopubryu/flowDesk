import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID } from "@/lib/demo";
import { normalizeEmployee } from "@/lib/master-data";
import { apiError, publicRow } from "@/lib/master-data-server";
type Ctx = { params: Promise<{ code: string }> };
export async function PUT(req: Request, ctx: Ctx) { try { const { code } = await ctx.params; const existing = await prisma.employee.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: decodeURIComponent(code).toUpperCase() } } }); if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 }); const data = normalizeEmployee(await req.json()); const row = await prisma.employee.update({ where: { id: existing.id }, data }); return NextResponse.json(publicRow(row)); } catch (error) { return apiError(error, "Failed to update employee"); } }
export async function DELETE(_req: Request, ctx: Ctx) { try { const { code } = await ctx.params; const result = await prisma.employee.deleteMany({ where: { workspaceId: DEMO_WORKSPACE_ID, code: decodeURIComponent(code).toUpperCase() } }); if (!result.count) return NextResponse.json({ error: "Not found" }, { status: 404 }); return NextResponse.json({ ok: true }); } catch (error) { return apiError(error, "Failed to delete employee"); } }

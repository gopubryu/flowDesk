import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID } from "@/lib/demo";
import { normalizeWarehouse } from "@/lib/master-data";
import { apiError, publicRow } from "@/lib/master-data-server";
type Ctx = { params: Promise<{ code: string }> };
export async function PUT(req: Request, ctx: Ctx) { try { const { code } = await ctx.params; const existing = await prisma.warehouse.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: decodeURIComponent(code).toUpperCase() } } }); if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 }); const row = await prisma.warehouse.update({ where: { id: existing.id }, data: normalizeWarehouse(await req.json()) }); return NextResponse.json(publicRow(row)); } catch (error) { return apiError(error, "Failed to update warehouse"); } }
export async function DELETE(_req: Request, ctx: Ctx) { try { const { code } = await ctx.params; const result = await prisma.warehouse.deleteMany({ where: { workspaceId: DEMO_WORKSPACE_ID, code: decodeURIComponent(code).toUpperCase() } }); if (!result.count) return NextResponse.json({ error: "Not found" }, { status: 404 }); return NextResponse.json({ ok: true }); } catch (error) { return apiError(error, "Failed to delete warehouse"); } }

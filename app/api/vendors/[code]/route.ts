import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID } from "@/lib/demo";
import { normalizeVendor } from "@/lib/master-data";
import { assertMasterCanDelete, assertMasterCanRename } from "@/lib/master-data-references";
import { apiError, publicRow } from "@/lib/master-data-server";
type Ctx = { params: Promise<{ code: string }> };
export async function PUT(req: Request, ctx: Ctx) { try { const { code } = await ctx.params; const oldCode = decodeURIComponent(code).toUpperCase(); const existing = await prisma.vendor.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: oldCode } } }); if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 }); const data = normalizeVendor(await req.json()); await assertMasterCanRename("vendor", DEMO_WORKSPACE_ID, oldCode, data.code); const row = await prisma.vendor.update({ where: { id: existing.id }, data }); return NextResponse.json(publicRow(row)); } catch (error) { return apiError(error, "Failed to update vendor"); } }
export async function DELETE(_req: Request, ctx: Ctx) { try { const { code } = await ctx.params; const vendorCode = decodeURIComponent(code).toUpperCase(); const existing = await prisma.vendor.findUnique({ where: { workspaceId_code: { workspaceId: DEMO_WORKSPACE_ID, code: vendorCode } } }); if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 }); await assertMasterCanDelete("vendor", DEMO_WORKSPACE_ID, vendorCode); await prisma.vendor.delete({ where: { id: existing.id } }); return NextResponse.json({ ok: true }); } catch (error) { return apiError(error, "Failed to delete vendor"); } }

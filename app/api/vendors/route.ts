import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, ensureDemoWorkspace } from "@/lib/demo";
import { normalizeVendor, SEED_VENDORS } from "@/lib/master-data";
import { apiError, publicRow } from "@/lib/master-data-server";
export const dynamic = "force-dynamic";
export async function GET() { try { await ensureDemoWorkspace(); if (await prisma.vendor.count({ where: { workspaceId: DEMO_WORKSPACE_ID } }) === 0) await prisma.vendor.createMany({ data: SEED_VENDORS.map(normalizeVendor).map(row => ({ ...row, workspaceId: DEMO_WORKSPACE_ID })), skipDuplicates: true }); const rows = await prisma.vendor.findMany({ where: { workspaceId: DEMO_WORKSPACE_ID }, orderBy: { code: "asc" } }); return NextResponse.json(rows.map(publicRow)); } catch (error) { return apiError(error, "Failed to load vendors"); } }
export async function POST(req: Request) { try { await ensureDemoWorkspace(); const data = normalizeVendor(await req.json()); const row = await prisma.vendor.create({ data: { ...data, workspaceId: DEMO_WORKSPACE_ID } }); return NextResponse.json(publicRow(row), { status: 201 }); } catch (error) { return apiError(error, "Failed to create vendor"); } }

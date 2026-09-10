import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, ensureDemoWorkspace } from "@/lib/demo";
import { normalizeWarehouse, SEED_WAREHOUSES } from "@/lib/master-data";
import { apiError, publicRow } from "@/lib/master-data-server";
export const dynamic = "force-dynamic";
export async function GET() { try { await ensureDemoWorkspace(); if (await prisma.warehouse.count({ where: { workspaceId: DEMO_WORKSPACE_ID } }) === 0) await prisma.warehouse.createMany({ data: SEED_WAREHOUSES.map(normalizeWarehouse).map(row => ({ ...row, workspaceId: DEMO_WORKSPACE_ID })), skipDuplicates: true }); const rows = await prisma.warehouse.findMany({ where: { workspaceId: DEMO_WORKSPACE_ID }, orderBy: { code: "asc" } }); return NextResponse.json(rows.map(publicRow)); } catch (error) { return apiError(error, "Failed to load warehouses"); } }
export async function POST(req: Request) { try { await ensureDemoWorkspace(); const data = normalizeWarehouse(await req.json()); const row = await prisma.warehouse.create({ data: { ...data, workspaceId: DEMO_WORKSPACE_ID } }); return NextResponse.json(publicRow(row), { status: 201 }); } catch (error) { return apiError(error, "Failed to create warehouse"); } }

import { NextResponse } from "next/server";
import type { MailFolder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { serializeMail } from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function makeSnippet(body: string) {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER],
    );
    const mail = await prisma.mailMessage.findFirst({ where: { id, workspaceId } });
    if (!mail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeMail(mail));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to load mail" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(body?.workspaceId, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const data: Record<string, unknown> = {};
    if (body.folder !== undefined) data.folder = body.folder as MailFolder;
    if (body.from !== undefined) data.from = String(body.from);
    if (body.to !== undefined) data.to = String(body.to);
    if (body.cc !== undefined) data.cc = body.cc ?? null;
    if (body.subject !== undefined) data.subject = String(body.subject);
    if (body.body !== undefined) {
      data.body = String(body.body);
      if (body.snippet === undefined) data.snippet = makeSnippet(String(body.body));
    }
    if (body.snippet !== undefined) data.snippet = body.snippet ?? null;
    if (body.starred !== undefined) data.starred = Boolean(body.starred);
    if (body.read !== undefined) data.read = Boolean(body.read);
    if (body.previousFolder !== undefined) data.previousFolder = body.previousFolder ?? null;

    const result = await prisma.mailMessage.updateMany({
      where: { id, workspaceId },
      data,
    });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await prisma.mailMessage.findFirstOrThrow({ where: { id, workspaceId } });
    return NextResponse.json(serializeMail(updated));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to update mail" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN],
    );
    const result = await prisma.mailMessage.deleteMany({
      where: { id, workspaceId },
    });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to delete mail" }, { status: 500 });
  }
}

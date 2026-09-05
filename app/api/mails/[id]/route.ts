import { NextResponse } from "next/server";
import type { MailFolder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_WORKSPACE_ID, serializeMail } from "@/lib/demo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function makeSnippet(body: string) {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
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
    if (body.previousFolder !== undefined) {
      data.previousFolder = body.previousFolder ?? null;
    }

    const result = await prisma.mailMessage.updateMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await prisma.mailMessage.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(serializeMail(updated));
  } catch (e) {
    console.error("PATCH /api/mails/[id]", e);
    return NextResponse.json({ error: "Failed to update mail" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await prisma.mailMessage.deleteMany({
      where: { id, workspaceId: DEMO_WORKSPACE_ID },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/mails/[id]", e);
    return NextResponse.json({ error: "Failed to delete mail" }, { status: 500 });
  }
}

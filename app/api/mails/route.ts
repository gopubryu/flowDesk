import { NextResponse } from "next/server";
import type { MailFolder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authError } from "@/lib/master-data-server";
import { requireResolvedWorkspace, WorkspaceRole } from "@/lib/workspace-auth";
import { serializeMail } from "@/lib/demo";

export const dynamic = "force-dynamic";

function makeSnippet(body: string) {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

export async function GET(req: Request) {
  try {
    const { workspaceId } = await requireResolvedWorkspace(
      new URL(req.url).searchParams.get("workspaceId"),
      [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER],
    );
    const mails = await prisma.mailMessage.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(mails.map(serializeMail));
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to load mails" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = await requireResolvedWorkspace(body?.workspaceId, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]);
    const text = String(body.body ?? "");
    const mail = await prisma.mailMessage.create({
      data: {
        workspaceId,
        folder: (body.folder as MailFolder) ?? "inbox",
        from: String(body.from ?? ""),
        to: String(body.to ?? ""),
        cc: body.cc ?? null,
        subject: String(body.subject ?? ""),
        body: text,
        snippet: body.snippet ?? makeSnippet(text),
        starred: Boolean(body.starred),
        read: body.read !== undefined ? Boolean(body.read) : false,
        previousFolder: (body.previousFolder as MailFolder | undefined) ?? null,
      },
    });
    return NextResponse.json(serializeMail(mail), { status: 201 });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Failed to create mail" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { MailFolder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEMO_WORKSPACE_ID,
  ensureDemoWorkspace,
  serializeMail,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

function makeSnippet(body: string) {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

export async function GET() {
  try {
    await ensureDemoWorkspace();
    const mails = await prisma.mailMessage.findMany({
      where: { workspaceId: DEMO_WORKSPACE_ID },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(mails.map(serializeMail));
  } catch (e) {
    console.error("GET /api/mails", e);
    return NextResponse.json({ error: "Failed to load mails" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDemoWorkspace();
    const body = await req.json();
    const text = String(body.body ?? "");
    const mail = await prisma.mailMessage.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
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
  } catch (e) {
    console.error("POST /api/mails", e);
    return NextResponse.json({ error: "Failed to create mail" }, { status: 500 });
  }
}

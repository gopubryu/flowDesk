import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { MasterDataValidationError } from "@/lib/master-data";
import { BadRequestError } from "@/lib/workspace-auth";
import { classifyAuthError } from "@/lib/auth-error-classifier";

export function publicRow<T extends Record<string, unknown>>(row: T) {
  const hidden = new Set(["id", "workspaceId", "createdAt", "updatedAt"]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.has(key)).map(([key, value]) => [key, value ?? undefined]));
}

export function authError(error: unknown) {
  const classified = classifyAuthError(error);
  if (classified?.kind === "unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (classified?.kind === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (classified?.kind === "bad_request") return NextResponse.json({ error: classified.message }, { status: 400 });
  return null;
}

export function apiError(error: unknown, message: string) {
  if (error instanceof MasterDataValidationError || error instanceof SyntaxError) {
    return NextResponse.json({ error: error.message || "Invalid request body" }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Code already exists" }, { status: 409 });
  }
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function bodyWorkspaceId(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestError("workspaceId is required");
  const value = (body as { workspaceId?: unknown }).workspaceId;
  if (typeof value !== "string" || !value.trim()) throw new BadRequestError("workspaceId is required");
  return value;
}

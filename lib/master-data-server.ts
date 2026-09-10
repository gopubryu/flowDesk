import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { MasterDataValidationError } from "@/lib/master-data";

export function publicRow<T extends Record<string, unknown>>(row: T) {
  const hidden = new Set(["id", "workspaceId", "createdAt", "updatedAt"]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.has(key)).map(([key, value]) => [key, value ?? undefined]));
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

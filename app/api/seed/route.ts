import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Alias of /api/demo/reset — wipe + reseed demo workspace. */
export async function POST() {
  const { POST: reset } = await import("../demo/reset/route");
  return reset();
}

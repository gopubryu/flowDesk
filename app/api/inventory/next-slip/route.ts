import { NextResponse } from "next/server";
import { ensureDemoWorkspace } from "@/lib/demo";
import { allocateSlipNo } from "@/lib/inventory-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureDemoWorkspace();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "receipt" | "shipment" | "adjustment" | null;
    const date = searchParams.get("date")?.trim();
    if (!type || !["receipt", "shipment", "adjustment"].includes(type)) {
      return NextResponse.json({ error: "type이 올바르지 않아요." }, { status: 400 });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date가 올바르지 않아요." }, { status: 400 });
    }
    const slipNo = await allocateSlipNo(type, date);
    return NextResponse.json({ slipNo });
  } catch (e) {
    console.error("GET /api/inventory/next-slip", e);
    return NextResponse.json({ error: "전표번호 채번에 실패했어요." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { classifyAddress } from "@/lib/classify";
import { saveBuilding } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  try {
    const building = await classifyAddress(address as `0x${string}`);
    await saveBuilding(building);
    return NextResponse.json(building);
  } catch (e) {
    return NextResponse.json({ error: "failed to read chain data" }, { status: 500 });
  }
}

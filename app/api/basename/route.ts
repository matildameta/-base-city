import { NextRequest, NextResponse } from "next/server";
import { resolveBasename } from "@/lib/basename";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const basename = await resolveBasename(address);
  return NextResponse.json({ basename });
}

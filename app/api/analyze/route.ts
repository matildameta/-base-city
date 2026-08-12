import { NextRequest, NextResponse } from "next/server";
import { classifyAddress } from "@/lib/classify";
import { getCity } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  try {
    const existing = (await getCity()).find(
      (b) => b.address.toLowerCase() === address.toLowerCase()
    );
    if (existing) {
      return NextResponse.json({ ...existing, alreadyMinted: true });
    }
    const preview = await classifyAddress(address as `0x${string}`);
    return NextResponse.json({ ...preview, alreadyMinted: false });
  } catch {
    return NextResponse.json({ error: "Failed to read chain data" }, { status: 500 });
  }
}

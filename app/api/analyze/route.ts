import { NextRequest, NextResponse } from "next/server";
import { classifyAddress } from "@/lib/classify";
import { getCity } from "@/lib/store";
import { resolveBasename } from "@/lib/basename";

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
    const [preview, basename] = await Promise.all([
      classifyAddress(address as `0x${string}`),
      resolveBasename(address),
    ]);
    return NextResponse.json({ ...preview, basename, alreadyMinted: false });
  } catch {
    return NextResponse.json({ error: "Failed to read chain data" }, { status: 500 });
  }
}

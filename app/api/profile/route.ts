import { NextRequest, NextResponse } from "next/server";
import { resolveBasename } from "@/lib/basename";
import { resolveFarcaster } from "@/lib/neynar";
import { ethUsdPrice } from "@/lib/price";

export const dynamic = "force-dynamic";

// Lightweight enrichment for an already-classified building: who owns it
// (Basename + Farcaster) and the live ETH price for USD conversion.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const [basename, farcaster, ethUsd] = await Promise.all([
    resolveBasename(address).catch(() => null),
    resolveFarcaster(address).catch(() => null),
    ethUsdPrice().catch(() => null),
  ]);
  return NextResponse.json({ address, basename, farcaster, ethUsd });
}

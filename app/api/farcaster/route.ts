import { NextRequest, NextResponse } from "next/server";
import { resolveFarcasterBulk } from "@/lib/neynar";

export const dynamic = "force-dynamic";

// Bulk Farcaster lookup for leaderboard / city rows.
// GET /api/farcaster?addresses=0x..,0x..
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("addresses") || "";
  const addresses = raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a))
    .slice(0, 100);
  if (addresses.length === 0) return NextResponse.json({ profiles: {} });
  const profiles = await resolveFarcasterBulk(addresses);
  return NextResponse.json({ profiles });
}

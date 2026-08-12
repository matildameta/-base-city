import { NextResponse } from "next/server";
import { getWalletStats } from "@/lib/walletStats";

export const dynamic = "force-dynamic";

const ADDR = /^0x[a-fA-F0-9]{40}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  if (!ADDR.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  try {
    const stats = await getWalletStats(address);
    return NextResponse.json({ address: address.toLowerCase(), stats });
  } catch {
    return NextResponse.json({ error: "Failed to compute wallet stats" }, { status: 500 });
  }
}

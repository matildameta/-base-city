import { NextRequest, NextResponse } from "next/server";
import { classifyAddress } from "@/lib/classify";
import { saveBuilding } from "@/lib/store";
import { resolveBasename } from "@/lib/basename";
import { publicClient } from "@/lib/baseClient";

export const dynamic = "force-dynamic";

const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "").toLowerCase();

async function waitForReceipt(hash: `0x${string}`, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      if (receipt) return receipt;
    } catch {
      /* not mined yet */
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!REGISTRY_ADDRESS) {
    return NextResponse.json(
      { error: "Registry contract not configured yet (NEXT_PUBLIC_REGISTRY_ADDRESS)" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const address = body?.address as string | undefined;
  const txHash = body?.txHash as string | undefined;

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
  }

  const receipt = await waitForReceipt(txHash as `0x${string}`);
  if (!receipt) {
    return NextResponse.json({ error: "Transaction not yet confirmed, try again shortly" }, { status: 409 });
  }
  if (receipt.status !== "success") {
    return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });
  }
  if ((receipt.to || "").toLowerCase() !== REGISTRY_ADDRESS) {
    return NextResponse.json({ error: "Transaction was not sent to the Base City registry" }, { status: 400 });
  }
  if ((receipt.from || "").toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: "Transaction sender does not match the claimed address" }, { status: 400 });
  }

  const building = await classifyAddress(address as `0x${string}`);
  const basename = await resolveBasename(address);
  const finalBuilding = { ...building, claimedAt: Date.now(), basename };
  await saveBuilding(finalBuilding);

  return NextResponse.json(finalBuilding);
}

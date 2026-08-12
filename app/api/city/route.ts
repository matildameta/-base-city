import { NextResponse } from "next/server";
import { getCity } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const buildings = await getCity();
  return NextResponse.json({ buildings });
}

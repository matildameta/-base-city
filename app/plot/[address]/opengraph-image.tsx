import { ImageResponse } from "next/og";
import { classifyAddress, ITEM_META, RARITY_META, rarityOf } from "@/lib/classify";

export const dynamic = "force-dynamic";
export const alt = "Base City plot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ADDR = /^0x[a-fA-F0-9]{40}$/;

function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

export default async function OG({ params }: { params: { address: string } }) {
  const addr = params.address;
  let label = "Unknown Plot";
  let accent = "#4fd0ff";
  let rarityLabel = "";
  let balance = "0.0000";
  let txns = "0";

  if (ADDR.test(addr)) {
    try {
      const b = await classifyAddress(addr as `0x${string}`);
      const meta = ITEM_META[b.itemType];
      label = meta.label;
      accent = meta.accent;
      const r = rarityOf(b);
      rarityLabel = RARITY_META[r].label;
      balance = b.balanceEth.toFixed(4);
      txns = String(b.txCount);
    } catch {
      /* fall back to defaults */
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #04060e 0%, #0a1330 55%, #132148 100%)",
          color: "#eaf0ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#0052ff,#4fd0ff)" }} />
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Base City</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 26, color: "#93a0bd" }}>This address becomes a</div>
          <div style={{ fontSize: 96, fontWeight: 800, color: accent, letterSpacing: -2 }}>{label}</div>
          {rarityLabel ? (
            <div
              style={{
                marginTop: 10,
                alignSelf: "flex-start",
                padding: "10px 26px",
                borderRadius: 999,
                border: `2px solid ${accent}`,
                color: accent,
                fontSize: 28,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {rarityLabel}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 56 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 44, fontWeight: 800 }}>{balance}</div>
              <div style={{ fontSize: 22, color: "#64708c" }}>ETH BALANCE</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 44, fontWeight: 800 }}>{txns}</div>
              <div style={{ fontSize: 22, color: "#64708c" }}>TRANSACTIONS</div>
            </div>
          </div>
          <div style={{ fontSize: 28, color: "#93a0bd" }}>{ADDR.test(addr) ? short(addr) : ""}</div>
        </div>
      </div>
    ),
    size
  );
}

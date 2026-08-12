import { ImageResponse } from "next/og";
import { classifyAddress, ITEM_META, RARITY_META, rarityOf } from "@/lib/classify";

export const dynamic = "force-dynamic";
export const alt = "Base City plot";
// Farcaster embed cards require a 3:2 image, so this doubles as the frame
// preview and the OpenGraph unfurl image at 1200x800.
export const size = { width: 1200, height: 800 };
export const contentType = "image/png";

const ADDR = /^0x[a-fA-F0-9]{40}$/;

function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

// a little skyline for brand consistency with the app's embed image
const BARS = [
  { h: 120, c: "#1c3a86" },
  { h: 190, c: "#24509c" },
  { h: 250, c: "#0052ff" },
  { h: 160, c: "#2f6fed" },
  { h: 300, c: "#4fd0ff" },
  { h: 210, c: "#2f6fed" },
  { h: 270, c: "#0052ff" },
  { h: 150, c: "#24509c" },
  { h: 200, c: "#1c3a86" },
  { h: 130, c: "#16244a" },
];

export default async function OG({ params }: { params: { address: string } }) {
  const addr = params.address;
  let label = "Unknown Plot";
  let emoji = "🏙️";
  let accent = "#4fd0ff";
  let rarityLabel = "";
  let rarityColor = "#4fd0ff";
  let balance = "0.0000";
  let txns = "0";

  if (ADDR.test(addr)) {
    try {
      const b = await classifyAddress(addr as `0x${string}`);
      const meta = ITEM_META[b.itemType];
      label = meta.label;
      emoji = meta.emoji;
      accent = meta.accent;
      const r = rarityOf(b);
      rarityLabel = RARITY_META[r].label;
      rarityColor = RARITY_META[r].color;
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
          background: "linear-gradient(160deg, #04060e 0%, #0a1330 58%, #0d1b45 100%)",
          color: "#eaf0ff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "58px 72px 0" }}>
          <div style={{ width: 54, height: 54, borderRadius: 15, background: "linear-gradient(135deg,#0052ff,#4fd0ff)" }} />
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Base City</div>
        </div>

        {/* main */}
        <div style={{ display: "flex", flexDirection: "column", padding: "40px 72px 0", flex: 1 }}>
          <div style={{ fontSize: 30, color: "#93a0bd" }}>This address becomes a</div>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 12 }}>
            <div style={{ fontSize: 108, lineHeight: 1 }}>{emoji}</div>
            <div style={{ fontSize: 100, fontWeight: 800, color: accent, letterSpacing: -2 }}>{label}</div>
          </div>
          {rarityLabel ? (
            <div
              style={{
                marginTop: 26,
                alignSelf: "flex-start",
                padding: "12px 30px",
                borderRadius: 999,
                border: `3px solid ${rarityColor}`,
                color: rarityColor,
                fontSize: 30,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 3,
                display: "flex",
              }}
            >
              {rarityLabel}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 64, marginTop: 40 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 50, fontWeight: 800 }}>{balance}</div>
              <div style={{ fontSize: 24, color: "#64708c", letterSpacing: 1 }}>ETH BALANCE</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 50, fontWeight: 800 }}>{txns}</div>
              <div style={{ fontSize: 24, color: "#64708c", letterSpacing: 1 }}>TRANSACTIONS</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 32, color: "#93a0bd" }}>{ADDR.test(addr) ? short(addr) : ""}</div>
            </div>
          </div>
        </div>

        {/* skyline footer */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, padding: "0 44px", height: 200 }}>
          {BARS.map((b, i) => (
            <div
              key={i}
              style={{ flex: 1, height: b.h, background: b.c, borderTopLeftRadius: 10, borderTopRightRadius: 10, opacity: 0.9 }}
            />
          ))}
        </div>
      </div>
    ),
    size
  );
}

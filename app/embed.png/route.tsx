import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

// Farcaster feed/embed preview — MUST be 3:2 aspect ratio (1200x800).
export async function GET() {
  const bars = [
    { h: 150, c: "#1c3a86" },
    { h: 230, c: "#24509c" },
    { h: 300, c: "#0052ff" },
    { h: 200, c: "#2f6fed" },
    { h: 360, c: "#4fd0ff" },
    { h: 260, c: "#2f6fed" },
    { h: 320, c: "#0052ff" },
    { h: 190, c: "#24509c" },
    { h: 250, c: "#1c3a86" },
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #04060e 0%, #0a1330 60%, #0d1b45 100%)",
          color: "#eaf0ff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "56px 64px 0" }}>
          <div style={{ width: 56, height: 56, borderRadius: 15, background: "linear-gradient(135deg,#0052ff,#4fd0ff)" }} />
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>Base City</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "26px 64px 0", flex: 1 }}>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>
            All of Base is a
          </div>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, color: "#4fd0ff" }}>
            living city.
          </div>
          <div style={{ fontSize: 27, color: "#93a0bd", marginTop: 18, maxWidth: 760 }}>
            Every address becomes a building. Scan a wallet, see who owns it, mint your plot.
          </div>
        </div>

        {/* skyline strip */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, padding: "0 44px", height: 380 }}>
          {bars.map((b, i) => (
            <div
              key={i}
              style={{ flex: 1, height: b.h, background: b.c, borderTopLeftRadius: 10, borderTopRightRadius: 10, opacity: 0.92 }}
            />
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 800 }
  );
}

import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

// Social share / mini-app embed image (1200x630).
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #04060e 0%, #0a1330 55%, #132148 100%)",
          color: "#eaf0ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg,#0052ff,#4fd0ff)" }} />
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>Base City</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02 }}>
            All of Base is a
          </div>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, color: "#4fd0ff" }}>
            living city.
          </div>
          <div style={{ fontSize: 34, color: "#93a0bd", marginTop: 8 }}>
            Every address becomes a building. Scan a wallet · find who owns it · mint your plot.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, color: "#64708c" }}>52 building types · on Base</div>
          <div
            style={{
              padding: "14px 30px",
              borderRadius: 999,
              background: "linear-gradient(135deg,#0052ff,#0a3ad1)",
              color: "#fff",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            🏙️ Open Base City
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

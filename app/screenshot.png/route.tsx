import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

// App Store style screenshot — portrait 1284x2778 (up to 3 allowed).
export async function GET() {
  const bars = [140, 260, 200, 420, 300, 520, 360, 240, 460, 300, 180, 380, 260];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #050a1c 0%, #0a1330 55%, #0d1b45 100%)",
          color: "#eaf0ff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "70px 60px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 70, height: 70, borderRadius: 18, background: "linear-gradient(135deg,#0052ff,#4fd0ff)" }} />
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>Base City</div>
          </div>
          <div style={{ padding: "18px 34px", borderRadius: 18, background: "linear-gradient(135deg,#0052ff,#0a3ad1)", fontSize: 34, fontWeight: 700 }}>
            Connect
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "120px 60px 0", flex: 1 }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>All of Base is</div>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, color: "#4fd0ff" }}>a living city.</div>
          <div style={{ fontSize: 40, color: "#93a0bd", marginTop: 30 }}>52 building types · Farcaster identities · on Base</div>

          {/* mock info card */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 70, padding: 48, borderRadius: 34, background: "rgba(13,19,36,0.9)", border: "2px solid rgba(120,150,210,0.28)" }}>
            <div style={{ fontSize: 88 }}>🏦</div>
            <div style={{ fontSize: 58, fontWeight: 800, marginTop: 12 }}>Bank & Vault</div>
            <div style={{ fontSize: 34, color: "#9cc7ff", marginTop: 10 }}>Legendary · downtown</div>
            <div style={{ display: "flex", gap: 30, marginTop: 34 }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 30, borderRadius: 22, background: "rgba(5,9,20,0.6)" }}>
                <div style={{ fontSize: 52, fontWeight: 800 }}>128.4 Ξ</div>
                <div style={{ fontSize: 28, color: "#64708c" }}>BALANCE</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 30, borderRadius: 22, background: "rgba(5,9,20,0.6)" }}>
                <div style={{ fontSize: 52, fontWeight: 800 }}>94/100</div>
                <div style={{ fontSize: 28, color: "#64708c" }}>ON-CHAIN SCORE</div>
              </div>
            </div>
          </div>
        </div>

        {/* skyline */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, padding: "0 40px", height: 640 }}>
          {bars.map((h, i) => (
            <div key={i} style={{ flex: 1, height: h, background: i % 3 === 0 ? "#4fd0ff" : "#20418f", borderTopLeftRadius: 12, borderTopRightRadius: 12, opacity: 0.9 }} />
          ))}
        </div>
      </div>
    ),
    { width: 1284, height: 2778 }
  );
}

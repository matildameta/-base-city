import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

// Splash image (200x200) shown while the mini app boots.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          background: "linear-gradient(135deg,#0052ff 0%,#4fd0ff 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, paddingBottom: 58 }}>
          <div style={{ width: 26, height: 62, borderRadius: 6, background: "#ffffff" }} />
          <div style={{ width: 26, height: 100, borderRadius: 6, background: "#ffffff" }} />
          <div style={{ width: 26, height: 82, borderRadius: 6, background: "#ffffff" }} />
        </div>
      </div>
    ),
    { width: 200, height: 200 }
  );
}

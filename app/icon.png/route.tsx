import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

// Square app icon (1024x1024) for the Farcaster mini-app manifest.
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
          gap: 64,
          padding: 0,
          background: "linear-gradient(135deg,#0052ff 0%,#4fd0ff 100%)",
        }}
      >
        {/* skyline bars */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 56, paddingBottom: 300 }}>
          <div style={{ width: 130, height: 320, borderRadius: 30, background: "#ffffff" }} />
          <div style={{ width: 130, height: 520, borderRadius: 30, background: "#ffffff" }} />
          <div style={{ width: 130, height: 420, borderRadius: 30, background: "#ffffff" }} />
        </div>
      </div>
    ),
    { width: 1024, height: 1024 }
  );
}

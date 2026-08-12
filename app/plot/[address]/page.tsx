import type { Metadata } from "next";
import Link from "next/link";
import { classifyAddress, ITEM_META, RARITY_META, rarityOf } from "@/lib/classify";
import { resolveBasename } from "@/lib/basename";
import { resolveFarcaster } from "@/lib/neynar";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";
const ADDR = /^0x[a-fA-F0-9]{40}$/;

function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

export async function generateMetadata({ params }: { params: { address: string } }): Promise<Metadata> {
  const addr = params.address;
  if (!ADDR.test(addr)) return { title: "Base City" };
  const title = `${short(addr)} · Base City`;
  const desc = "See which building this address becomes in Base City.";
  const img = `${APP_URL}/plot/${addr}/opengraph-image`;
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, images: [img] },
    other: {
      "fc:frame": JSON.stringify({
        version: "1",
        imageUrl: img,
        button: {
          title: "🏙️ Open Base City",
          action: { type: "launch_frame", name: "Base City", url: APP_URL, splashBackgroundColor: "#0b0f1a" },
        },
      }),
    },
  };
}

export default async function PlotPage({ params }: { params: { address: string } }) {
  const addr = params.address;
  if (!ADDR.test(addr)) {
    return (
      <main style={wrap}>
        <div className="reveal-card" style={{ maxWidth: 420 }}>
          <div className="reveal-label">Invalid address</div>
          <div className="reveal-addr">That is not a valid 0x address.</div>
          <div className="reveal-actions" style={{ marginTop: 18 }}>
            <Link href="/"><button style={{ width: "100%" }}>Open Base City</button></Link>
          </div>
        </div>
      </main>
    );
  }

  const [b, basename, farcaster] = await Promise.all([
    classifyAddress(addr as `0x${string}`),
    resolveBasename(addr).catch(() => null),
    resolveFarcaster(addr).catch(() => null),
  ]);
  const meta = ITEM_META[b.itemType];
  const rarity = rarityOf(b);

  return (
    <main style={{ ...wrap, ["--reveal-accent" as any]: meta.accent }}>
      <div className="reveal-card" style={{ maxWidth: 440 }}>
        <div className="reveal-emoji float">{meta.emoji}</div>
        <div className="reveal-label">{meta.label}</div>
        {farcaster ? (
          <div className="owner-row" style={{ justifyContent: "center" }}>
            {farcaster.pfpUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="owner-pfp" src={farcaster.pfpUrl} alt="" />
            ) : null}
            <div className="owner-meta">
              <div className="owner-name">{farcaster.displayName || farcaster.username}</div>
              <div className="owner-sub">@{farcaster.username} · {farcaster.followerCount.toLocaleString()} followers</div>
            </div>
          </div>
        ) : (
          <div className="reveal-addr">{basename || short(addr)}</div>
        )}
        <div className="rarity-chip" style={{ ["--reveal-accent" as any]: RARITY_META[rarity].color }}>
          {RARITY_META[rarity].label}
        </div>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="stat-value">{b.balanceEth.toFixed(4)}</div>
            <div className="stat-label">ETH Balance</div>
          </div>
          <div className="stat-tile">
            <div className="stat-value">{b.txCount}</div>
            <div className="stat-label">Transactions</div>
          </div>
        </div>
        <div className="reveal-actions">
          <Link href="/"><button style={{ width: "100%", justifyContent: "center" }}>🏙️ Open Base City</button></Link>
        </div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "radial-gradient(circle at 50% 35%, #0a1330, #04060e 70%)",
};

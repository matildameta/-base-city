"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { encodeFunctionData } from "viem";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import CityCanvas, { CameraControls } from "@/components/CityCanvas";
import type { CityBuilding, ItemType, Rarity } from "@/lib/classify";
import { ITEM_META, RARITY_META, rarityOf } from "@/lib/classify";
import type { FarcasterProfile } from "@/lib/neynar";

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined;

// Base mainnet (chainId 8453 = 0x2105) — used to force-switch the wallet.
const BASE_CHAIN_ID = "0x2105";
const BASE_CHAIN_PARAMS = {
  chainId: BASE_CHAIN_ID,
  chainName: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};

// A building enriched with owner identity + live price (client-side only).
type Enriched = CityBuilding & {
  basename?: string | null;
  farcaster?: FarcasterProfile | null;
  ethUsd?: number | null;
};

const REGISTRY_ABI = [
  { type: "function", name: "claimPlot", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

const SCAN_STEPS = [
  "Reading balance on Base",
  "Scanning transaction history",
  "Detecting contract bytecode",
  "Assigning your city plot",
];

function short(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// eased numeric count-up used in the reveal stat tiles
function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <>
      {n.toFixed(decimals)}
      {suffix}
    </>
  );
}
function fireConfetti(color: string) {
  const common = { spread: 70, startVelocity: 42, ticks: 220, zIndex: 60 };
  confetti({ ...common, particleCount: 70, origin: { x: 0.5, y: 0.4 }, colors: [color, "#ffffff", "#4fd0ff"] });
  setTimeout(() => confetti({ ...common, particleCount: 40, angle: 60, origin: { x: 0, y: 0.6 } }), 150);
  setTimeout(() => confetti({ ...common, particleCount: 40, angle: 120, origin: { x: 1, y: 0.6 } }), 150);
}

export default function Page() {
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [selected, setSelected] = useState<Enriched | null>(null);
  const [fcMap, setFcMap] = useState<Record<string, FarcasterProfile | null>>({});
  const fcFetched = useRef<Set<string>>(new Set());

  // scan + reveal flow
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [reveal, setReveal] = useState<(Enriched & { alreadyMinted?: boolean }) | null>(null);

  const cameraRef = useRef<CameraControls | null>(null);

  // when a building in the city is clicked, show its card and resolve
  // the owner's Base domain (basename) so we can tell who it is.
  const handlePick = useCallback((b: CityBuilding | null) => {
    setSelected(b);
    if (!b) return;
    fetch(`/api/profile?address=${b.address}`)
      .then((r) => r.json())
      .then((j) => {
        setSelected((cur) =>
          cur && cur.address.toLowerCase() === b.address.toLowerCase()
            ? { ...cur, basename: j?.basename ?? null, farcaster: j?.farcaster ?? null, ethUsd: j?.ethUsd ?? null }
            : cur
        );
      })
      .catch(() => {
        setSelected((cur) =>
          cur && cur.address.toLowerCase() === b.address.toLowerCase()
            ? { ...cur, basename: cur.basename ?? null, farcaster: null }
            : cur
        );
      });
  }, []);

  const loadCity = useCallback(async () => {
    try {
      const res = await fetch("/api/city", { cache: "no-store" });
      const json = await res.json();
      setBuildings(json.buildings || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCity();
    const iv = setInterval(loadCity, 8000);
    return () => clearInterval(iv);
  }, [loadCity]);

  useEffect(() => {
    import("@farcaster/miniapp-sdk")
      .then(({ sdk }) => sdk.actions.ready().catch(() => {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // resolve Farcaster identities for city members (for the leaderboard + rows)
  useEffect(() => {
    const missing = buildings
      .map((b) => b.address.toLowerCase())
      .filter((a) => !fcFetched.current.has(a))
      .slice(0, 100);
    if (missing.length === 0) return;
    missing.forEach((a) => fcFetched.current.add(a));
    fetch(`/api/farcaster?addresses=${missing.join(",")}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.profiles) setFcMap((prev) => ({ ...prev, ...j.profiles }));
      })
      .catch(() => {});
  }, [buildings]);

  // scanning overlay drives through the steps, then reveals the plot
  async function runScan(addr: string) {
    setError("");
    setSelected(null);
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError("That doesn't look like a valid address (0x + 40 hex chars)");
      return;
    }
    setReveal(null);
    setScanning(true);
    setScanStep(0);
    const stepIv = setInterval(() => setScanStep((s) => Math.min(SCAN_STEPS.length - 1, s + 1)), 620);
    const started = Date.now();
    try {
      const res = await fetch(`/api/analyze?address=${addr}`);
      const json = await res.json();
      await new Promise((r) => setTimeout(r, Math.max(0, 2500 - (Date.now() - started))));
      clearInterval(stepIv);
      setScanning(false);
      if (json.error) {
        setError(json.error);
        return;
      }
      setReveal(json);
      const r = rarityOf(json);
      if (r === "legendary" || r === "epic" || r === "rare") fireConfetti(RARITY_META[r].color);
    } catch {
      clearInterval(stepIv);
      setScanning(false);
      setError("Failed to read on-chain data");
    }
  }
  async function ensureBaseNetwork(eth: any) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_ID }] });
    } catch (e: any) {
      // 4902 = chain not added to the wallet yet
      if (e?.code === 4902) {
        try {
          await eth.request({ method: "wallet_addEthereumChain", params: [BASE_CHAIN_PARAMS] });
        } catch {
          /* user declined adding Base */
        }
      }
    }
  }

  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("No wallet found — open this inside the Base App or a Farcaster wallet browser");
      return;
    }
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      await ensureBaseNetwork(eth);
      setAccount(accounts[0]);
      setInput(accounts[0]);
      runScan(accounts[0]);
    } catch {
      setError("Wallet connection was rejected");
    }
  }

  function disconnectWallet() {
    setAccount(null);
    setInput("");
    setReveal(null);
    setSelected(null);
    setError("");
    setToast("Wallet disconnected");
  }

  async function mint() {
    const eth = (window as any).ethereum;
    if (!eth || !reveal) return;
    if (!account) {
      setError("Connect your wallet first to mint");
      return;
    }
    if (account.toLowerCase() !== reveal.address.toLowerCase()) {
      setError("Connect the same wallet as the address you're previewing to mint it");
      return;
    }
    if (!REGISTRY_ADDRESS) {
      setError("The Base City registry contract isn't deployed yet — see README.md");
      return;
    }
    setMinting(true);
    setError("");
    try {
      await ensureBaseNetwork(eth);
      const data = encodeFunctionData({ abi: REGISTRY_ABI, functionName: "claimPlot" });
      const txHash = await eth.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: REGISTRY_ADDRESS, data }],
      });
      setToast("Transaction sent — waiting for confirmation on Base...");
      const claimRes = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account, txHash }),
      });
      const claimed = await claimRes.json();
      if (claimed.error) {
        setError(claimed.error);
      } else {
        setToast(`🎉 You're permanently part of Base City as a ${ITEM_META[claimed.itemType as ItemType].label}!`);
        setReveal(null);
        setInput("");
        await loadCity();
      }
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setMinting(false);
    }
  }

  const leaderboard = [...buildings]
    .sort((a, b) => b.balanceEth * 10 + b.txCount - (a.balanceEth * 10 + a.txCount))
    .slice(0, 50);
  const revealRarity: Rarity | null = reveal ? rarityOf(reveal) : null;
  const revealMeta = reveal ? ITEM_META[reveal.itemType as ItemType] : null;

  // live city stats
  const citizens = buildings.length;
  const totalEth = buildings.reduce((s, b) => s + b.balanceEth, 0);
  const whales = buildings.filter((b) => b.zone === "downtown").length;
  const contracts = buildings.filter((b) => b.isContract).length;
  const onFarcaster = buildings.filter((b) => fcMap[b.address.toLowerCase()]).length;

  // owner label used across rows/cards: Farcaster > Basename > short address
  function ownerName(b: Enriched): string {
    const fc = b.farcaster ?? fcMap[b.address.toLowerCase()];
    if (fc?.username) return `@${fc.username}`;
    if (b.basename) return b.basename;
    return short(b.address);
  }
  function pfpOf(b: Enriched): string | null {
    const fc = b.farcaster ?? fcMap[b.address.toLowerCase()];
    return fc?.pfpUrl ?? null;
  }

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
  function shareToWarpcast(b: Enriched) {
    const meta = ITEM_META[b.itemType as ItemType];
    const url = `${APP_URL}/plot/${b.address}`;
    const text = `${ownerName(b)} is a ${meta.label} ${meta.emoji} in Base City 🏙️`;
    const intent = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="stage">
      <CityCanvas buildings={buildings} ghostBuilding={reveal} onPick={handlePick} cameraRef={cameraRef} />

      <div className="overlay-top">
        <div className="brand">
          <div className="brand-mark">🏙️</div>
          <div>
            <div className="brand-text">Base City</div>
            <div className="brand-sub">On-chain, on Base</div>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={() => setShowInfo(true)}>
            ℹ️ What is this?
          </button>
          <button className="ghost" onClick={() => setShowLeaderboard((v) => !v)}>
            🏆 Leaderboard
          </button>
          {account ? (
            <button className="ghost" onClick={disconnectWallet} title="Disconnect wallet">
              🟢 {short(account)} · Disconnect
            </button>
          ) : (
            <button onClick={connectWallet}>Connect Wallet</button>
          )}
        </div>
      </div>

      {/* ---- live city stats bar ---- */}
      <div className="city-stats">
        <div className="cstat"><b>{citizens}</b><span>citizens</span></div>
        <div className="cstat"><b>{totalEth.toFixed(2)} Ξ</b><span>on-chain</span></div>
        <div className="cstat"><b>{whales}</b><span>downtown</span></div>
        <div className="cstat"><b>{contracts}</b><span>contracts</span></div>
        <div className="cstat"><b>{onFarcaster}</b><span>on Farcaster</span></div>
      </div>

      {/* ---- creator credit ---- */}
      <a
        className="credit"
        href="https://x.com/sadeghss2"
        target="_blank"
        rel="noreferrer"
        title="Built by openmeta — @sadeghss2 on X"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span>Built by <b>openmeta</b></span>
      </a>

      {/* ---- info modal ---- */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="modal-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              className="reveal-card"
              style={{ maxWidth: 480, textAlign: "left" }}
              initial={{ scale: 0.9, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="reveal-emoji" style={{ fontSize: 44 }}>🏙️</div>
              <div className="reveal-label" style={{ fontSize: 22 }}>What is Base City?</div>
              <p className="info-p">
                Base City turns the <b>Base blockchain</b> into a living pixel skyline. Every wallet
                address becomes <b>one of 52 buildings</b> — from ruins for empty wallets to
                skyscrapers for whales — decided live from its real on-chain balance, activity and
                whether it&apos;s a smart contract.
              </p>
              <p className="info-p">
                <b>Scan any address</b> (or connect your wallet) to see what it becomes. Owners show
                up by their <b>Farcaster</b> profile or <b>Basename</b>. Click any building to see
                who it is, their balance in ETH &amp; USD, and share it.
              </p>
              <p className="info-p">
                <b>Mint your plot</b> with a real transaction on Base and you&apos;re a permanent
                citizen — visible to everyone, forever.
              </p>
              <div className="reveal-actions">
                <button onClick={() => setShowInfo(false)}>Explore the city 🏙️</button>
                <a href="https://x.com/sadeghss2" target="_blank" rel="noreferrer">
                  <button className="ghost" style={{ width: "100%", justifyContent: "center" }}>
                    Follow the creator @openmeta on X
                  </button>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="legend">
        <div className="legend-title">5 districts · 52 building types</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#6b7280" }} />🪦 Outskirts — dead / dust wallets <span className="legend-ex">🕳️🗑️🚮🪑🛣️🥀🧱🚗⛺</span></div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#5b82c4" }} />🏡 Residential — holders <span className="legend-ex">🏚️🏠🏡🏘️🛖🏢🏙️🏛️🏰🌆</span></div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#e08b52" }} />🏪 Market Street — traders <span className="legend-ex">🛒🎪☕👗🏪🛍️🕹️🏨🏬📈</span></div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#9b7bff" }} />🏛️ Downtown — whales &amp; DAOs <span className="legend-ex">🏢⚖️🏛️🏳️🗼💹🏦🌃🔭</span></div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#7a8590" }} />🏭 Industrial — contracts <span className="legend-ex">🔧📦🏭⚓⛽⚡☀️🖥️</span></div>
        <div className="legend-foot">Your wallet becomes 1 of 52 unique buildings — decided by balance, activity &amp; contract code.</div>
      </div>

      <div className="zoom-controls">
        <button className="small" onClick={() => cameraRef.current?.zoomIn()}>＋</button>
        <button className="small" onClick={() => cameraRef.current?.zoomOut()}>－</button>
        <button className="small" onClick={() => cameraRef.current?.reset()}>⟳</button>
      </div>

      {toast && <div className="toast">{toast}</div>}
      {/* ---- scanning overlay ---- */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            className="modal-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="reveal-card"
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="scan-ring" />
              <div className="scan-title">Reading the chain…</div>
              <div className="reveal-addr">{short(input)}</div>
              <div className="scan-steps">
                {SCAN_STEPS.map((s, i) => (
                  <div key={s} className={`scan-step ${i < scanStep ? "done" : i === scanStep ? "active" : ""}`}>
                    <span className="dot" />
                    {s}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- reveal modal ---- */}
      <AnimatePresence>
        {reveal && revealMeta && revealRarity && (
          <motion.div
            className="modal-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ ["--reveal-accent" as any]: revealMeta.accent }}
          >
            <motion.div
              className="reveal-card"
              initial={{ scale: 0.82, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <motion.div
                className="reveal-emoji float"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 12 }}
              >
                {revealMeta.emoji}
              </motion.div>
              <div className="reveal-label">{revealMeta.label}</div>
              {reveal.farcaster ? (
                <div className="owner-row" style={{ justifyContent: "center" }}>
                  {reveal.farcaster.pfpUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="owner-pfp" src={reveal.farcaster.pfpUrl} alt="" />
                  ) : null}
                  <div className="owner-meta">
                    <div className="owner-name">{reveal.farcaster.displayName || reveal.farcaster.username}{reveal.farcaster.powerBadge && " ⚡"}</div>
                    <div className="owner-sub">@{reveal.farcaster.username} · {reveal.farcaster.followerCount.toLocaleString()} followers</div>
                  </div>
                </div>
              ) : (
                <div className="reveal-addr">{ownerName(reveal)}</div>
              )}
              <div className="rarity-chip">{RARITY_META[revealRarity].label}</div>
              <div className="stat-grid">
                <div className="stat-tile">
                  <div className="stat-value"><CountUp value={reveal.balanceEth} decimals={4} /> Ξ</div>
                  <div className="stat-label">
                    {reveal.ethUsd ? `≈ $${(reveal.balanceEth * reveal.ethUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "ETH Balance"}
                  </div>
                </div>
                <div className="stat-tile">
                  <div className="stat-value"><CountUp value={reveal.txCount} /></div>
                  <div className="stat-label">Transactions</div>
                </div>
              </div>
              <div className="reveal-actions">
                {reveal.alreadyMinted ? (
                  <div className="reveal-note">✅ This address already has a permanent spot in the city.</div>
                ) : (
                  <button onClick={mint} disabled={minting}>
                    {minting ? "Minting on Base…" : "🧾 Mint this plot on Base"}
                  </button>
                )}
                <button className="ghost" onClick={() => shareToWarpcast(reveal)}>🟣 Share on Warpcast</button>
                <button className="ghost" onClick={() => setReveal(null)}>Close</button>
                {error && <div className="error-row">{error}</div>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ---- picked-building info card ---- */}
      {selected && !reveal && !scanning && (
        <motion.div
          className="reveal-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "fixed",
            left: "50%",
            bottom: 96,
            transform: "translateX(-50%)",
            width: "min(360px, 92vw)",
            ["--reveal-accent" as any]: ITEM_META[selected.itemType as ItemType].accent,
          }}
        >
          <div className="reveal-emoji" style={{ fontSize: 46 }}>{ITEM_META[selected.itemType as ItemType].emoji}</div>
          <div className="reveal-label" style={{ fontSize: 20 }}>{ITEM_META[selected.itemType as ItemType].label}</div>

          {/* owner identity: Farcaster > Basename > address */}
          {(() => {
            const fc = selected.farcaster ?? fcMap[selected.address.toLowerCase()];
            if (fc) {
              return (
                <div className="owner-row">
                  {fc.pfpUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="owner-pfp" src={fc.pfpUrl} alt="" />
                  ) : null}
                  <div className="owner-meta">
                    <div className="owner-name">
                      {fc.displayName || fc.username}
                      {fc.powerBadge && <span title="Power badge"> ⚡</span>}
                    </div>
                    <div className="owner-sub">@{fc.username} · {fc.followerCount.toLocaleString()} followers</div>
                  </div>
                </div>
              );
            }
            if (selected.basename) {
              return <div className="reveal-addr" style={{ color: "var(--reveal-accent)", fontWeight: 700 }}>🔵 {selected.basename}</div>;
            }
            if (selected.farcaster === undefined && selected.basename === undefined) {
              return <div className="reveal-addr" style={{ opacity: 0.7 }}>Resolving identity…</div>;
            }
            return <div className="reveal-addr">{short(selected.address)}</div>;
          })()}
          {selected.farcaster?.bio && <div className="owner-bio">“{selected.farcaster.bio}”</div>}

          <div className="rarity-chip" style={{ ["--reveal-accent" as any]: RARITY_META[rarityOf(selected)].color }}>
            {RARITY_META[rarityOf(selected)].label} · {ITEM_META[selected.itemType as ItemType].zone}
          </div>

          <div className="stat-grid">
            <div className="stat-tile">
              <div className="stat-value">{selected.balanceEth.toFixed(4)} Ξ</div>
              <div className="stat-label">
                {selected.ethUsd ? `≈ $${(selected.balanceEth * selected.ethUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "ETH Balance"}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{selected.txCount.toLocaleString()}</div>
              <div className="stat-label">{selected.isContract ? "Contract calls" : "Transactions"}</div>
            </div>
          </div>
          <div className="chip-row">
            <span className="mini-chip">{selected.isContract ? "🤖 Smart contract" : "👛 Wallet (EOA)"}</span>
            <span className="mini-chip">nonce {selected.txCount}</span>
            {(selected.farcaster ?? fcMap[selected.address.toLowerCase()]) && (
              <span className="mini-chip">fid {(selected.farcaster ?? fcMap[selected.address.toLowerCase()])!.fid}</span>
            )}
          </div>

          <div className="reveal-actions">
            <button onClick={() => shareToWarpcast(selected)}>🟣 Share on Warpcast</button>
            <a href={`https://basescan.org/address/${selected.address}`} target="_blank" rel="noreferrer">
              <button className="ghost" style={{ width: "100%", justifyContent: "center" }}>🔎 View on Basescan</button>
            </a>
            <button className="ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
        </motion.div>
      )}

      {/* ---- search dock ---- */}
      {!reveal && !selected && !scanning && (
        <div className="search-bar">
          <div className="search-row">
            <input
              type="text"
              placeholder="Enter a Base wallet address (0x...)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runScan(input.trim())}
            />
            <button onClick={() => runScan(input.trim())}>Scan 🔍</button>
          </div>
          {error && <div className="error-row">{error}</div>}
          {!error && <div className="hint-row">Scroll to zoom · drag to pan · the city updates for everyone in real time</div>}
        </div>
      )}

      {/* ---- leaderboard ---- */}
      {showLeaderboard && (
        <div className="panel">
          <div className="panel-header">
            <span>🏆 Base City Members</span>
            <button className="panel-close" onClick={() => setShowLeaderboard(false)}>✕</button>
          </div>
          <div className="panel-body">
            {leaderboard.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: "var(--text-dim)" }}>
                No one has minted yet — be the first citizen of Base City.
              </div>
            )}
            {leaderboard.map((b, i) => {
              const fc = fcMap[b.address.toLowerCase()];
              return (
                <div className="lb-row" key={b.address} onClick={() => handlePick(b)}>
                  <div className="lb-rank">{i + 1}</div>
                  {fc?.pfpUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="lb-pfp" src={fc.pfpUrl} alt="" />
                  ) : (
                    <div className="lb-emoji">{ITEM_META[b.itemType as ItemType].emoji}</div>
                  )}
                  <div className="lb-info">
                    <div className="lb-name">{ownerName(b)}</div>
                    <div className="lb-type">{ITEM_META[b.itemType as ItemType].label}</div>
                  </div>
                  <span className="badge">{b.balanceEth.toFixed(2)} Ξ</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


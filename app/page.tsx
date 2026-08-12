"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { encodeFunctionData } from "viem";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import CityCanvas, { CameraControls } from "@/components/CityCanvas";
import type { CityBuilding, ItemType, Rarity } from "@/lib/classify";
import { ITEM_META, RARITY_META, rarityOf } from "@/lib/classify";

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined;

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

function displayName(b: { address: string; basename?: string | null }) {
  return b.basename || short(b.address);
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
  const [selected, setSelected] = useState<CityBuilding | null>(null);

  // scan + reveal flow
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [reveal, setReveal] = useState<(CityBuilding & { alreadyMinted?: boolean }) | null>(null);

  const cameraRef = useRef<CameraControls | null>(null);

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
  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("No wallet found — open this inside the Base App or a Farcaster wallet browser");
      return;
    }
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      setInput(accounts[0]);
      runScan(accounts[0]);
    } catch {
      setError("Wallet connection was rejected");
    }
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

  return (
    <div className="stage">
      <CityCanvas buildings={buildings} ghostBuilding={reveal} onPick={setSelected} cameraRef={cameraRef} />

      <div className="overlay-top">
        <div className="brand">
          <div className="brand-mark">🏙️</div>
          <div>
            <div className="brand-text">Base City</div>
            <div className="brand-sub">On-chain, on Base</div>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={() => setShowLeaderboard((v) => !v)}>
            🏆 Leaderboard
          </button>
          {account ? (
            <button className="ghost" disabled>
              🟢 {short(account)}
            </button>
          ) : (
            <button onClick={connectWallet}>Connect Wallet</button>
          )}
        </div>
      </div>

      <div className="legend">
        <div className="legend-title">Districts</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#6b7280" }} />🪦 Outskirts — dead wallets</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#5b82c4" }} />🏡 Residential — holders</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#e08b52" }} />🏪 Market Street — traders</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#9b7bff" }} />🏛️ Downtown — whales &amp; DAOs</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#7a8590" }} />🏭 Industrial — contracts</div>
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
              <div className="reveal-addr">{displayName(reveal)}</div>
              <div className="rarity-chip">{RARITY_META[revealRarity].label}</div>
              <div className="stat-grid">
                <div className="stat-tile">
                  <div className="stat-value"><CountUp value={reveal.balanceEth} decimals={4} /></div>
                  <div className="stat-label">ETH Balance</div>
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
          <div className="reveal-addr">{displayName(selected)}</div>
          <div className="stat-grid">
            <div className="stat-tile">
              <div className="stat-value">{selected.balanceEth.toFixed(4)}</div>
              <div className="stat-label">ETH Balance</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{selected.txCount}</div>
              <div className="stat-label">Transactions</div>
            </div>
          </div>
          <div className="reveal-actions">
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
            {leaderboard.map((b, i) => (
              <div className="lb-row" key={b.address} onClick={() => { setSelected(b); cameraRef.current?.focusOn(0); }}>
                <div className="lb-rank">{i + 1}</div>
                <div className="lb-emoji">{ITEM_META[b.itemType as ItemType].emoji}</div>
                <div className="lb-info">
                  <div className="lb-name">{displayName(b)}</div>
                  <div className="lb-type">{ITEM_META[b.itemType as ItemType].label}</div>
                </div>
                <span className="badge">{b.balanceEth.toFixed(2)} Ξ</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


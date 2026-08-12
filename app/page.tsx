"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { encodeFunctionData } from "viem";
import CityCanvas, { CameraControls } from "@/components/CityCanvas";
import type { CityBuilding, ItemType } from "@/lib/classify";
import { ITEM_META } from "@/lib/classify";

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined;

const REGISTRY_ABI = [
  { type: "function", name: "claimPlot", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

function short(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function displayName(b: { address: string; basename?: string | null }) {
  return b.basename || short(b.address);
}

export default function Page() {
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState<(CityBuilding & { alreadyMinted?: boolean }) | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selected, setSelected] = useState<CityBuilding | null>(null);

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

  async function previewAddress(addr: string) {
    setError("");
    setSelected(null);
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError("That doesn't look like a valid address (0x + 40 hex chars)");
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/analyze?address=${addr}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setPreview(json);
    } catch {
      setError("Failed to read on-chain data");
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("No wallet found — open this inside the Base App or a Farcaster wallet browser");
      return;
    }
    const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
    setInput(accounts[0]);
    previewAddress(accounts[0]);
  }

  async function mint() {
    const eth = (window as any).ethereum;
    if (!eth || !preview) return;
    if (!account) {
      setError("Connect your wallet first to mint");
      return;
    }
    if (account.toLowerCase() !== preview.address.toLowerCase()) {
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
        setPreview(null);
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

  return (
    <div className="stage">
      <CityCanvas buildings={buildings} ghostBuilding={preview} onPick={setSelected} cameraRef={cameraRef} />

      <div className="overlay-top">
        <div className="brand">🏙️ Base City</div>
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
        <div><b>Zones</b></div>
        <div>🪦 Outskirts — dead wallets</div>
        <div>🏡 Residential — holders</div>
        <div>🏪 Market Street — traders</div>
        <div>🏛️ Downtown — whales &amp; DAOs</div>
        <div>🏭 Industrial — active contracts</div>
      </div>

      <div className="zoom-controls">
        <button className="small" onClick={() => cameraRef.current?.zoomIn()}>＋</button>
        <button className="small" onClick={() => cameraRef.current?.zoomOut()}>－</button>
        <button className="small" onClick={() => cameraRef.current?.reset()}>⟳</button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {preview && (
        <div className="preview-card">
          <div className="preview-title">
            {preview.alreadyMinted ? "✅ Already part of Base City" : "🏗️ "}
            {ITEM_META[preview.itemType as ItemType].label}
          </div>
          <div className="preview-addr">{displayName(preview)}</div>
          <div className="preview-stats">
            <div>Balance: <b>{preview.balanceEth.toFixed(4)} ETH</b></div>
            <div>Txns: <b>{preview.txCount}</b></div>
          </div>
          {!preview.alreadyMinted ? (
            <button onClick={mint} disabled={minting} style={{ width: "100%" }}>
              {minting ? "Minting on Base..." : "🧾 Mint this item on Base"}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: "#7d89a6" }}>
              This address already has a permanent spot in the city.
            </div>
          )}
        </div>
      )}

      {selected && !preview && (
        <div className="preview-card">
          <div className="preview-title">{ITEM_META[selected.itemType as ItemType].label}</div>
          <div className="preview-addr">{displayName(selected)}</div>
          <div className="preview-stats">
            <div>Balance: <b>{selected.balanceEth.toFixed(4)} ETH</b></div>
            <div>Txns: <b>{selected.txCount}</b></div>
          </div>
          <button className="ghost" style={{ width: "100%" }} onClick={() => setSelected(null)}>
            Close
          </button>
        </div>
      )}

      {!preview && !selected && (
        <div className="search-bar">
          <div className="search-row">
            <input
              type="text"
              placeholder="Enter a Base wallet address (0x...)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && previewAddress(input.trim())}
            />
            <button onClick={() => previewAddress(input.trim())} disabled={loading}>
              {loading ? "Scanning..." : "Preview 🔍"}
            </button>
          </div>
          {error && <div className="error-row">{error}</div>}
          {!error && <div className="hint-row">Scroll to zoom, drag to pan — city updates for everyone in real time</div>}
        </div>
      )}
      {(preview || selected) && error && <div className="error-row" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)" }}>{error}</div>}

      {showLeaderboard && (
        <div className="panel">
          <div className="panel-header">
            <span>🏆 Base City Members</span>
            <button className="panel-close" onClick={() => setShowLeaderboard(false)}>✕</button>
          </div>
          <div className="panel-body">
            {leaderboard.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: "#7d89a6" }}>
                No one has minted yet — be the first citizen of Base City.
              </div>
            )}
            {leaderboard.map((b, i) => (
              <div className="lb-row" key={b.address}>
                <div className="lb-rank">#{i + 1}</div>
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

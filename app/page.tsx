"use client";

import { useEffect, useState, useCallback } from "react";
import { encodeFunctionData } from "viem";
import CityCanvas from "@/components/CityCanvas";
import type { CityBuilding } from "@/lib/classify";

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined;

const REGISTRY_ABI = [
  {
    type: "function",
    name: "claimPlot",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

const TYPE_LABEL: Record<string, string> = {
  house: "خانه (ETH holder)",
  shop: "مغازه (Trader)",
  office: "ساختمان اداری (DAO / Contract پیچیده)",
  tower: "برج (Whale)",
  factory: "کارخانه (Contract فعال)",
  ruin: "ساختمان متروکه (Dead wallet)",
};

export default function Page() {
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<CityBuilding | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

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
    const iv = setInterval(loadCity, 8000); // real-time-ish refresh
    return () => clearInterval(iv);
  }, [loadCity]);

  useEffect(() => {
    // Farcaster Mini App: tell the host we're ready to be shown
    import("@farcaster/miniapp-sdk")
      .then(({ sdk }) => sdk.actions.ready().catch(() => {}))
      .catch(() => {});
  }, []);

  async function addAddress(addr: string) {
    setError("");
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError("آدرس معتبر نیست (باید 0x + 40 کاراکتر باشد)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/analyze?address=${addr}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        await loadCity();
        setSelected(json);
      }
    } catch {
      setError("خطا در خواندن اطلاعات زنجیره");
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("کیف پول (Base App / Farcaster wallet) پیدا نشد");
      return;
    }
    const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
    addAddress(accounts[0]);
  }

  async function claimPlot() {
    const eth = (window as any).ethereum;
    if (!eth || !account) return;
    if (!REGISTRY_ADDRESS) {
      setError("قرارداد ثبت زمین هنوز دیپلوی نشده — راهنمای contracts/ را ببین");
      return;
    }
    setClaiming(true);
    setError("");
    try {
      const data = encodeFunctionData({ abi: REGISTRY_ABI, functionName: "claimPlot" });
      const txHash = await eth.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: REGISTRY_ADDRESS, data }],
      });
      await addAddress(account); // refresh building after on-chain claim
      setError(`✅ تراکنش ارسال شد: ${txHash.slice(0, 10)}...`);
    } catch (e: any) {
      setError(e?.message || "تراکنش ناموفق بود");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">🏙️ Base City</div>
        {account ? (
          <button className="ghost" onClick={claimPlot} disabled={claiming}>
            {claiming ? "در حال ثبت..." : "🧾 ثبت مالکیت زمین (Base tx)"}
          </button>
        ) : (
          <button className="ghost" onClick={connectWallet}>
            اتصال کیف پول
          </button>
        )}
      </div>

      <div className="controls">
        <input
          type="text"
          placeholder="آدرس Base را وارد کن (0x...)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addAddress(input.trim())}
        />
        <button onClick={() => addAddress(input.trim())} disabled={loading}>
          {loading ? "در حال ساخت..." : "بساز 🏗️"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="hint">شهر هر ۸ ثانیه به‌روزرسانی می‌شود — روی هر ساختمان کلیک کن.</div>

      <div style={{ position: "relative", flex: 1 }}>
        <CityCanvas buildings={buildings} onPick={setSelected} />
        {selected && (
          <div className="panel">
            <div>
              <b>{TYPE_LABEL[selected.type]}</b>
            </div>
            <div>
              آدرس: {selected.address.slice(0, 6)}...{selected.address.slice(-4)}
            </div>
            <div>
              موجودی: <span className="stat">{selected.balanceEth.toFixed(4)} ETH</span>
            </div>
            <div>
              تعداد تراکنش: <span className="stat">{selected.txCount}</span>
            </div>
            <div>قرارداد؟ {selected.isContract ? "بله" : "خیر"}</div>
          </div>
        )}
      </div>

      <div className="legend">
        <span>
          <i className="dot" style={{ background: "#5b82c4" }} /> خانه
        </span>
        <span>
          <i className="dot" style={{ background: "#e08b52" }} /> مغازه
        </span>
        <span>
          <i className="dot" style={{ background: "#4fc9ae" }} /> اداری/DAO
        </span>
        <span>
          <i className="dot" style={{ background: "#9b7bff" }} /> برج (Whale)
        </span>
        <span>
          <i className="dot" style={{ background: "#9c9c9c" }} /> کارخانه
        </span>
        <span>
          <i className="dot" style={{ background: "#3d3d3d" }} /> متروکه
        </span>
      </div>
    </div>
  );
}

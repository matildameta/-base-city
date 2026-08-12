"use client";

import { useEffect, useState } from "react";
import type { WalletStats } from "@/lib/walletStats";

function short(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}
function fmtEth(n: number) {
  if (n === 0) return "0";
  if (n < 0.001) return n.toExponential(1);
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 });
}
function fmtAge(days: number | null) {
  if (days == null) return "—";
  if (days < 31) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m ? `${y}y ${m}mo` : `${y}y`;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtNum(n: number) {
  return n.toLocaleString();
}

// Renders the full on-chain analytics grid (30 metrics) for one address.
// Lazily fetches /api/stats and shows a loading shimmer until ready.
export default function WalletStatsPanel({ address, rank, total }: { address: string; rank?: number | null; total?: number }) {
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setFailed(false);
    fetch(`/api/stats?address=${address}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.stats) setStats(j.stats);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [address]);

  if (failed) return null;
  if (!stats) return <div className="stats-loading">Reading full on-chain history…</div>;
  if (!stats.hasData)
    return <div className="stats-loading">No Base transaction history for this address yet.</div>;

  const rankStr = rank && total ? `#${rank} / ${total}` : "—";
  const flow = stats.ethFlowRatio == null ? "—" : `${stats.ethFlowRatio}×`;

  const rows: [string, string | number][] = [
    ["Wallet Age", fmtAge(stats.walletAgeDays)],
    ["Activity Streak", `${stats.activityStreakDays}d`],
    ["On-chain Score", `${stats.onChainScore}/100`],
    ["Builder Score", `${stats.builderScore}/100`],
    ["Base City Rank", rankStr],
    ["Resident Level", stats.residentLevel],
    ["Total Gas", `${fmtEth(stats.totalGasEth)} Ξ`],
    ["Contracts Used", fmtNum(stats.contractsUsed)],
    ["Contract Deploys", fmtNum(stats.contractDeployments)],
    ["NFTs", fmtNum(stats.nftCount)],
    ["Token Diversity", fmtNum(stats.tokenDiversity)],
    ["Token Holdings", fmtNum(stats.tokenHoldings)],
    ["ETH Received", `${fmtEth(stats.totalReceivedEth)} Ξ`],
    ["ETH Sent", `${fmtEth(stats.totalSentEth)} Ξ`],
    ["ETH Flow (in/out)", flow],
    ["Tx Volume", `${fmtEth(stats.txVolumeEth)} Ξ`],
    ["Largest Tx", `${fmtEth(stats.largestTxEth)} Ξ`],
    ["Unique Addresses", fmtNum(stats.uniqueAddresses)],
    ["Wallet Connections", fmtNum(stats.walletConnections)],
    ["Success Rate", stats.successRate == null ? "—" : `${stats.successRate}%`],
    ["Active Months", fmtNum(stats.activeMonths)],
    ["Interactions / Day", String(stats.interactionsPerDay)],
    ["Most Active Day", fmtDate(stats.mostActiveDay ? `${stats.mostActiveDay}T00:00:00Z` : null)],
    ["First Tx", fmtDate(stats.firstTxDate)],
    ["Last Activity", fmtDate(stats.lastActivity)],
    ["First Base Block", stats.firstBaseBlock ? `#${fmtNum(stats.firstBaseBlock)}` : "—"],
    ["Favorite dApp", stats.favoriteDapp ? short(stats.favoriteDapp) : "—"],
    ["Top Contract", stats.topContract ? short(stats.topContract) : "—"],
  ];

  return (
    <div className="stats-panel">
      <div className="stats-hero">
        <div className="stats-identity">{stats.cityIdentity}</div>
        <div className="stats-type">{stats.walletType} · {stats.txTotal.toLocaleString()} txns</div>
        <div className="stats-score-bar">
          <div className="stats-score-fill" style={{ width: `${stats.onChainScore}%` }} />
        </div>
      </div>
      <div className="stats-grid30">
        {rows.map(([k, v]) => (
          <div className="stat30" key={k}>
            <div className="stat30-v">{v}</div>
            <div className="stat30-k">{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

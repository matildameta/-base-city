import { formatEther } from "viem";

// Rich on-chain wallet analytics for a Base address, computed from the
// Etherscan V2 unified API (chainId 8453). Set ETHERSCAN_API_KEY in the
// environment (a single Etherscan key works across all chains on V2).
// Everything degrades gracefully to null when the key/history is missing.

const V2 = "https://api.etherscan.io/v2/api";
const CHAIN_ID = 8453;
const KEY = process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "";

export type WalletType = "Newcomer" | "Trader" | "Holder" | "Builder" | "Explorer";
export type ResidentLevel = "Newcomer" | "Resident" | "Veteran" | "Legend";

export interface WalletStats {
  txTotal: number;
  walletAgeDays: number | null;
  activityStreakDays: number;
  totalGasEth: number;
  contractsUsed: number;
  favoriteDapp: string | null;
  walletType: WalletType;
  firstBaseBlock: number | null;
  nftCount: number;
  tokenDiversity: number;
  onChainScore: number;
  totalReceivedEth: number;
  totalSentEth: number;
  uniqueAddresses: number;
  contractDeployments: number;
  mostActiveDay: string | null;
  txVolumeEth: number;
  largestTxEth: number;
  tokenHoldings: number;
  cityIdentity: string;
  successRate: number | null;
  activeMonths: number;
  interactionsPerDay: number;
  topContract: string | null;
  firstTxDate: string | null;
  lastActivity: string | null;
  walletConnections: number;
  ethFlowRatio: number | null;
  builderScore: number;
  residentLevel: ResidentLevel;
  hasData: boolean;
}

interface Tx {
  timeStamp: string;
  blockNumber: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  isError: string;
  input: string;
  contractAddress: string;
}

interface TokenTx {
  from: string;
  to: string;
  contractAddress: string;
  tokenID?: string;
}

async function fetchList<T>(action: string, address: string): Promise<T[]> {
  const url = `${V2}?chainid=${CHAIN_ID}&module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    const json = await res.json();
    if (json.status === "1" && Array.isArray(json.result)) return json.result as T[];
    return [];
  } catch {
    return [];
  }
}

function dayKey(tsSec: number) {
  return new Date(tsSec * 1000).toISOString().slice(0, 10);
}

function emptyStats(): WalletStats {
  return {
    txTotal: 0,
    walletAgeDays: null,
    activityStreakDays: 0,
    totalGasEth: 0,
    contractsUsed: 0,
    favoriteDapp: null,
    walletType: "Newcomer",
    firstBaseBlock: null,
    nftCount: 0,
    tokenDiversity: 0,
    onChainScore: 0,
    totalReceivedEth: 0,
    totalSentEth: 0,
    uniqueAddresses: 0,
    contractDeployments: 0,
    mostActiveDay: null,
    txVolumeEth: 0,
    largestTxEth: 0,
    tokenHoldings: 0,
    cityIdentity: "Ghost",
    successRate: null,
    activeMonths: 0,
    interactionsPerDay: 0,
    topContract: null,
    firstTxDate: null,
    lastActivity: null,
    walletConnections: 0,
    ethFlowRatio: null,
    builderScore: 0,
    residentLevel: "Newcomer",
    hasData: false,
  };
}

const cache = new Map<string, { at: number; data: WalletStats }>();
const TTL = 5 * 60 * 1000;

export async function getWalletStats(address: string): Promise<WalletStats> {
  const addr = address.toLowerCase();
  const hit = cache.get(addr);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const [txs, erc20, nfts] = await Promise.all([
    fetchList<Tx>("txlist", addr),
    fetchList<TokenTx>("tokentx", addr),
    fetchList<TokenTx>("tokennfttx", addr),
  ]);

  const stats = computeStats(addr, txs, erc20, nfts);
  cache.set(addr, { at: Date.now(), data: stats });
  return stats;
}


function computeStats(addr: string, txs: Tx[], erc20: TokenTx[], nfts: TokenTx[]): WalletStats {
  if (txs.length === 0 && erc20.length === 0 && nfts.length === 0) return emptyStats();

  let sentWei = 0n;
  let recvWei = 0n;
  let gasWei = 0n;
  let volumeWei = 0n;
  let largestWei = 0n;
  let deployments = 0;
  let errors = 0;
  const counterparties = new Set<string>();
  const contractsInteracted = new Set<string>();
  const toCounts = new Map<string, number>();
  const contractCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  const monthSet = new Set<string>();
  const daySet = new Set<string>();

  for (const t of txs) {
    const from = t.from?.toLowerCase() || "";
    const to = t.to?.toLowerCase() || "";
    let value = 0n;
    try { value = BigInt(t.value || "0"); } catch { /* ignore */ }
    volumeWei += value;
    if (value > largestWei) largestWei = value;
    if (from === addr) {
      sentWei += value;
      try { gasWei += BigInt(t.gasUsed || "0") * BigInt(t.gasPrice || "0"); } catch { /* ignore */ }
      if (!to && t.contractAddress) deployments++;
      if (t.isError === "1") errors++;
      if (to) { counterparties.add(to); toCounts.set(to, (toCounts.get(to) || 0) + 1); }
      // a call with calldata is a contract interaction
      if (to && t.input && t.input.length > 2) {
        contractsInteracted.add(to);
        contractCounts.set(to, (contractCounts.get(to) || 0) + 1);
      }
    } else if (to === addr) {
      recvWei += value;
      if (from) counterparties.add(from);
    }
    const ts = parseInt(t.timeStamp || "0", 10);
    if (ts) {
      const dk = dayKey(ts);
      daySet.add(dk);
      dayCounts.set(dk, (dayCounts.get(dk) || 0) + 1);
      monthSet.add(dk.slice(0, 7));
    }
  }

  const timestamps = txs.map((t) => parseInt(t.timeStamp || "0", 10)).filter(Boolean).sort((a, b) => a - b);
  const firstTs = timestamps[0] || 0;
  const lastTs = timestamps[timestamps.length - 1] || 0;
  const firstBlock = txs.length ? parseInt(txs[0].blockNumber || "0", 10) || null : null;

  // longest consecutive-day streak
  const sortedDays = [...daySet].sort();
  let streak = sortedDays.length ? 1 : 0;
  let best = streak;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = Date.parse(sortedDays[i - 1]);
    const cur = Date.parse(sortedDays[i]);
    if (cur - prev === 86400000) { streak++; best = Math.max(best, streak); }
    else streak = 1;
  }

  const topOf = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mostActiveDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const nftIds = new Set(nfts.map((n) => `${n.contractAddress}:${n.tokenID}`));
  const tokenContracts = new Set(erc20.map((t) => t.contractAddress.toLowerCase()));

  const sent = parseFloat(formatEther(sentWei));
  const recv = parseFloat(formatEther(recvWei));
  const gas = parseFloat(formatEther(gasWei));
  const volume = parseFloat(formatEther(volumeWei));
  const largest = parseFloat(formatEther(largestWei));

  const ageDays = firstTs ? Math.max(1, Math.round((Date.now() / 1000 - firstTs) / 86400)) : null;
  const activeDays = daySet.size || 1;
  const interactionsPerDay = +(txs.length / activeDays).toFixed(2);
  const successRate = txs.length ? +(((txs.length - errors) / txs.length) * 100).toFixed(1) : null;
  const ethFlowRatio = sent > 0 ? +(recv / sent).toFixed(2) : recv > 0 ? Infinity : null;

  // composite 0-100 on-chain score (log-scaled so it saturates gracefully)
  const scale = (v: number, cap: number) => Math.min(1, Math.log10(1 + v) / Math.log10(1 + cap));
  const onChainScore = Math.round(
    100 *
      (0.28 * scale(txs.length, 2000) +
        0.16 * scale(ageDays || 0, 900) +
        0.16 * scale(tokenContracts.size, 60) +
        0.14 * scale(contractsInteracted.size, 200) +
        0.14 * scale(volume, 500) +
        0.12 * scale(counterparties.size, 400))
  );
  const builderScore = Math.min(
    100,
    Math.round(deployments * 18 + scale(contractsInteracted.size, 200) * 40 + scale(txs.length, 2000) * 20)
  );

  // wallet type from dominant behaviour
  let walletType: WalletType = "Explorer";
  if (txs.length < 5) walletType = "Newcomer";
  else if (deployments >= 3 || builderScore >= 55) walletType = "Builder";
  else if (tokenContracts.size >= 8 && txs.length >= 40) walletType = "Trader";
  else if (recv > sent * 1.5 && txs.length < 60) walletType = "Holder";

  // resident level from tenure + activity
  let residentLevel: ResidentLevel = "Newcomer";
  if ((ageDays || 0) >= 365 && txs.length >= 300) residentLevel = "Legend";
  else if ((ageDays || 0) >= 180 && txs.length >= 80) residentLevel = "Veteran";
  else if (txs.length >= 15) residentLevel = "Resident";

  // playful city identity nickname
  let cityIdentity = "Wanderer";
  if (deployments >= 3) cityIdentity = "The Architect";
  else if (largest >= 50) cityIdentity = "The Whale";
  else if (tokenContracts.size >= 15) cityIdentity = "The Collector";
  else if (nftIds.size >= 20) cityIdentity = "The Curator";
  else if (best >= 14) cityIdentity = "The Regular";
  else if ((ageDays || 0) >= 500) cityIdentity = "The Elder";
  else if (txs.length >= 300) cityIdentity = "The Hustler";
  else if (txs.length < 5) cityIdentity = "The Newcomer";

  return {
    txTotal: txs.length,
    walletAgeDays: ageDays,
    activityStreakDays: best,
    totalGasEth: gas,
    contractsUsed: contractsInteracted.size,
    favoriteDapp: topOf(toCounts),
    walletType,
    firstBaseBlock: firstBlock,
    nftCount: nftIds.size,
    tokenDiversity: tokenContracts.size,
    onChainScore,
    totalReceivedEth: recv,
    totalSentEth: sent,
    uniqueAddresses: counterparties.size,
    contractDeployments: deployments,
    mostActiveDay,
    txVolumeEth: volume,
    largestTxEth: largest,
    tokenHoldings: tokenContracts.size,
    cityIdentity,
    successRate,
    activeMonths: monthSet.size,
    interactionsPerDay,
    topContract: topOf(contractCounts) ?? topOf(toCounts),
    firstTxDate: firstTs ? new Date(firstTs * 1000).toISOString() : null,
    lastActivity: lastTs ? new Date(lastTs * 1000).toISOString() : null,
    walletConnections: counterparties.size,
    ethFlowRatio: ethFlowRatio === Infinity ? null : ethFlowRatio,
    builderScore,
    residentLevel,
    hasData: true,
  };
}

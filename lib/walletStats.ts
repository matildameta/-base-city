import { formatEther } from "viem";

// Rich on-chain wallet analytics for a Base address.
//
// Primary source is Blockscout (base.blockscout.com) — a free Base explorer that
// needs no API key. It exposes both an Etherscan-compatible `/api` surface and a
// richer `/api/v2` REST surface; we use the v2 counters endpoint for exact
// lifetime totals and the compat surface for per-transaction behaviour.
// Etherscan V2 is tried as a secondary source when ETHERSCAN_API_KEY is set
// (note: Etherscan's free plan does NOT cover Base, so a key is optional).
// Blockscout rate-limits bursts hard, so every request is serialized with a
// small gap and retried with backoff. Everything degrades gracefully.

const V2 = "https://api.etherscan.io/v2/api";
const CHAIN_ID = 8453;
const KEY = process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "";
const BLOCKSCOUT = "https://base.blockscout.com/api";
const BLOCKSCOUT_V2 = "https://base.blockscout.com/api/v2";

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

// Blockscout rate-limits parallel bursts, so every request goes through one
// serialized queue with a small gap plus retry/backoff. A single 250-tx page is
// enough to characterise behaviour while staying fast; exact lifetime totals
// come from the v2 counters endpoint instead.
const TX_PAGE = 250;
const GAP_MS = 320;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(() => sleep(GAP_MS), () => sleep(GAP_MS));
  return run;
}

function rateLimited(status: number, json: unknown): boolean {
  if (status === 429) return true;
  const msg = String((json as { message?: string })?.message || "").toLowerCase();
  return msg.includes("too many requests") || msg.includes("rate limit");
}

async function getJson(url: string, tries = 3, timeoutMs = 15000): Promise<Record<string, any> | null> {
  for (let i = 0; i < tries; i++) {
    const out = await serialize(async () => {
      try {
        const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
        const json = await res.json();
        if (rateLimited(res.status, json)) return "retry" as const;
        return json as Record<string, any>;
      } catch {
        return "retry" as const;
      }
    });
    if (out !== "retry") return out;
    await sleep(900 * (i + 1));
  }
  return null;
}

function compatUrls(action: string, address: string, sort: "asc" | "desc", offset: number): string[] {
  const common = `module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&page=1&offset=${offset}&sort=${sort}`;
  const urls = [`${BLOCKSCOUT}?${common}`]; // free, no key required
  if (KEY) urls.push(`${V2}?chainid=${CHAIN_ID}&${common}&apikey=${KEY}`);
  return urls;
}

async function fetchList<T>(
  action: string,
  address: string,
  sort: "asc" | "desc" = "asc",
  offset: number = TX_PAGE
): Promise<T[]> {
  for (const url of compatUrls(action, address, sort, offset)) {
    const json = await getJson(url);
    if (!json) continue;
    if (json.status === "1" && Array.isArray(json.result)) return json.result as T[];
    // A definitive "no transactions" answer is a valid empty result — stop here.
    const msg = String(json.message || "").toLowerCase();
    if (json.status === "0" && (msg.includes("no transactions") || msg.includes("no records") || msg.includes("not found"))) {
      return [];
    }
    // otherwise (missing key, provider error) fall through to the next provider
  }
  return [];
}

// The v2 REST surface has a more generous budget than the Etherscan-compat one,
// so transactions are sampled from it first (50 per page) and the compat surface
// is only used as a fallback.
const V2_PAGES = 2;

interface V2Tx {
  timestamp?: string;
  block_number?: number;
  gas_used?: string | number;
  gas_price?: string | number;
  value?: string;
  result?: string;
  raw_input?: string;
  created_contract?: { hash?: string } | null;
  to?: { hash?: string } | null;
  from?: { hash?: string } | null;
}

function fromV2(t: V2Tx): Tx {
  const ts = t.timestamp ? Math.floor(Date.parse(t.timestamp) / 1000) : 0;
  return {
    timeStamp: ts ? String(ts) : "0",
    blockNumber: String(t.block_number ?? ""),
    from: t.from?.hash || "",
    to: t.to?.hash || "",
    value: String(t.value ?? "0"),
    gasUsed: String(t.gas_used ?? "0"),
    gasPrice: String(t.gas_price ?? "0"),
    isError: t.result === "success" ? "0" : "1",
    input: t.raw_input || "0x",
    contractAddress: t.created_contract?.hash || "",
  };
}

// Newest-first sample of transactions, paged through the v2 REST surface.
async function fetchRecentV2(address: string, pages = V2_PAGES): Promise<Tx[]> {
  const out: Tx[] = [];
  let query = "";
  for (let p = 0; p < pages; p++) {
    const json = await getJson(`${BLOCKSCOUT_V2}/addresses/${address}/transactions${query}`);
    const items = Array.isArray(json?.items) ? (json!.items as V2Tx[]) : null;
    if (!items) break;
    out.push(...items.map(fromV2));
    const next = json?.next_page_params as Record<string, string | number> | null | undefined;
    if (!next) break;
    query = "?" + new URLSearchParams(Object.entries(next).map(([k, v]) => [k, String(v)])).toString();
  }
  return out;
}

async function fetchRecent(address: string, pages = V2_PAGES): Promise<Tx[]> {
  const v2 = await fetchRecentV2(address, pages);
  if (v2.length) return v2;
  return fetchList<Tx>("txlist", address, "desc", TX_PAGE);
}

// Single oldest transaction — gives an exact wallet age and first Base block.
// Only the Etherscan-compat surface can sort ascending, and it is the tightest
// rate limit, so this is a best-effort single attempt.
async function fetchOldest(address: string): Promise<Tx | undefined> {
  for (const url of compatUrls("txlist", address, "asc", 1)) {
    const json = await getJson(url, 1, 10000);
    if (json?.status === "1" && Array.isArray(json.result) && json.result[0]) {
      return json.result[0] as Tx;
    }
  }
  return undefined;
}

interface Counters {
  txTotal: number | null;
  gasUsed: number | null;
  tokenTransfers: number | null;
}

// Exact lifetime totals — not capped by paging.
async function fetchCounters(address: string): Promise<Counters> {
  const json = await getJson(`${BLOCKSCOUT_V2}/addresses/${address}/counters`);
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    txTotal: num(json?.transactions_count),
    gasUsed: num(json?.gas_usage_count),
    tokenTransfers: num(json?.token_transfers_count),
  };
}

interface TokenSummary {
  erc20Count: number;
  nftCount: number;
}

// One call covers both ERC-20 diversity and NFT holdings. Heavy for very large
// wallets, so a failure just leaves these two metrics at zero.
async function fetchTokenSummary(address: string): Promise<TokenSummary> {
  const json = await getJson(`${BLOCKSCOUT_V2}/addresses/${address}/token-balances`, 1, 8000);
  const list = Array.isArray(json) ? (json as unknown as Array<Record<string, any>>) : [];
  let erc20Count = 0;
  let nftCount = 0;
  for (const entry of list) {
    const type = String(entry?.token?.type || "");
    if (type === "ERC-20") erc20Count++;
    else if (type) nftCount += Math.max(1, Number(entry?.value) || 1);
  }
  return { erc20Count, nftCount };
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
const TTL = 30 * 60 * 1000;

export async function getWalletStats(address: string): Promise<WalletStats> {
  const addr = address.toLowerCase();
  const hit = cache.get(addr);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  // Counters are cheap and tell us how much history exists, which decides how
  // many transaction pages are worth pulling.
  const counters = await fetchCounters(addr);
  const lifetime = counters.txTotal ?? 0;
  const pages = lifetime && lifetime <= 200 ? 5 : V2_PAGES;

  // Serialized under the hood — Promise.all here just keeps the code flat.
  const [recent, oldest, tokens] = await Promise.all([
    // newest transactions drive behavioural metrics and "Last Activity"
    fetchRecent(addr, pages),
    // oldest tx gives an exact wallet age / first Base block when available
    fetchOldest(addr),
    fetchTokenSummary(addr),
  ]);

  const stats = computeStats(addr, recent, tokens, oldest, counters);
  // only cache a result we actually managed to populate
  if (stats.hasData || counters.txTotal === 0) cache.set(addr, { at: Date.now(), data: stats });
  return stats;
}


function computeStats(
  addr: string,
  txs: Tx[],
  tokens: TokenSummary,
  oldestTx?: Tx,
  counters?: Counters
): WalletStats {
  const lifetimeTx = counters?.txTotal ?? 0;
  const tokenTransfers = counters?.tokenTransfers ?? 0;
  if (txs.length === 0 && lifetimeTx === 0 && tokenTransfers === 0 && tokens.erc20Count === 0 && tokens.nftCount === 0) {
    return emptyStats();
  }

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
  // The sample is newest-first and capped, so the oldest tx in it is only the
  // real first transaction when the whole history fits in the sample.
  const sampleIsWholeHistory = lifetimeTx <= txs.length;
  const oldestTs = parseInt(oldestTx?.timeStamp || "0", 10) || 0;
  const firstTs = oldestTs || (sampleIsWholeHistory ? timestamps[0] || 0 : 0);
  const lastTs = timestamps[timestamps.length - 1] || 0;
  const firstBlock =
    parseInt(oldestTx?.blockNumber || "0", 10) ||
    (sampleIsWholeHistory && txs.length ? parseInt(txs[txs.length - 1].blockNumber || "0", 10) : 0) ||
    null;

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

  const nftCount = tokens.nftCount;
  const tokenContractCount = tokens.erc20Count;

  const sent = parseFloat(formatEther(sentWei));
  const recv = parseFloat(formatEther(recvWei));
  const gas = parseFloat(formatEther(gasWei));
  const volume = parseFloat(formatEther(volumeWei));
  const largest = parseFloat(formatEther(largestWei));

  const ageDays = firstTs ? Math.max(1, Math.round((Date.now() / 1000 - firstTs) / 86400)) : null;
  const activeDays = daySet.size || 1;
  // lifetime count when the explorer gives it; otherwise the sampled page size
  const txTotal = Math.max(lifetimeTx, txs.length);
  const interactionsPerDay = +(txs.length / activeDays).toFixed(2);
  const successRate = txs.length ? +(((txs.length - errors) / txs.length) * 100).toFixed(1) : null;
  const ethFlowRatio = sent > 0 ? +(recv / sent).toFixed(2) : recv > 0 ? Infinity : null;

  // composite 0-100 on-chain score (log-scaled so it saturates gracefully)
  const scale = (v: number, cap: number) => Math.min(1, Math.log10(1 + v) / Math.log10(1 + cap));
  const onChainScore = Math.round(
    100 *
      (0.28 * scale(txTotal, 2000) +
        0.16 * scale(ageDays || 0, 900) +
        0.16 * scale(tokenContractCount, 60) +
        0.14 * scale(contractsInteracted.size, 200) +
        0.14 * scale(volume, 500) +
        0.12 * scale(counterparties.size, 400))
  );
  const builderScore = Math.min(
    100,
    Math.round(deployments * 18 + scale(contractsInteracted.size, 200) * 40 + scale(txTotal, 2000) * 20)
  );

  // wallet type from dominant behaviour
  let walletType: WalletType = "Explorer";
  if (txTotal < 5) walletType = "Newcomer";
  else if (deployments >= 3 || builderScore >= 55) walletType = "Builder";
  else if (tokenContractCount >= 8 && txTotal >= 40) walletType = "Trader";
  else if (recv > sent * 1.5 && txTotal < 60) walletType = "Holder";

  // resident level from tenure + activity
  let residentLevel: ResidentLevel = "Newcomer";
  if ((ageDays || 0) >= 365 && txTotal >= 300) residentLevel = "Legend";
  else if ((ageDays || 0) >= 180 && txTotal >= 80) residentLevel = "Veteran";
  else if (txTotal >= 15) residentLevel = "Resident";

  // playful city identity nickname
  let cityIdentity = "Wanderer";
  if (deployments >= 3) cityIdentity = "The Architect";
  else if (largest >= 50) cityIdentity = "The Whale";
  else if (tokenContractCount >= 15) cityIdentity = "The Collector";
  else if (nftCount >= 20) cityIdentity = "The Curator";
  else if (best >= 14) cityIdentity = "The Regular";
  else if ((ageDays || 0) >= 500) cityIdentity = "The Elder";
  else if (txTotal >= 300) cityIdentity = "The Hustler";
  else if (txTotal < 5) cityIdentity = "The Newcomer";

  return {
    txTotal,
    walletAgeDays: ageDays,
    activityStreakDays: best,
    totalGasEth: gas,
    contractsUsed: contractsInteracted.size,
    favoriteDapp: topOf(toCounts),
    walletType,
    firstBaseBlock: firstBlock,
    nftCount: nftCount,
    tokenDiversity: tokenContractCount,
    onChainScore,
    totalReceivedEth: recv,
    totalSentEth: sent,
    uniqueAddresses: counterparties.size,
    contractDeployments: deployments,
    mostActiveDay,
    txVolumeEth: volume,
    largestTxEth: largest,
    tokenHoldings: tokenContractCount,
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

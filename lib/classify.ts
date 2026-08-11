import { formatEther } from "viem";
import { publicClient } from "./baseClient";

export type BuildingType =
  | "house" // ETH holder, low activity
  | "shop" // trader, frequent tx
  | "office" // DAO / multisig-like contract
  | "tower" // whale
  | "factory" // active contract (dapp)
  | "ruin"; // dead wallet

export interface CityBuilding {
  address: string;
  type: BuildingType;
  balanceEth: number;
  txCount: number;
  isContract: boolean;
  height: number; // 1-10, drives visual size
  complexity: number; // 1-5, drives visual detail
  lastSeen: number;
}

const WHALE_ETH = 50; // >50 ETH on Base = whale tower
const ACTIVE_TX = 200; // frequent-tx threshold for "trader"

async function basescanTxCount(address: string): Promise<number | null> {
  const key = process.env.BASESCAN_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.basescan.org/api?module=account&action=txlist&address=${address}&page=1&offset=1&sort=desc&apikey=${key}`,
      { next: { revalidate: 0 } }
    );
    const json = await res.json();
    // txlist doesn't give total count directly; fall back to null (RPC nonce used instead)
    return Array.isArray(json.result) ? json.result.length : null;
  } catch {
    return null;
  }
}

export async function classifyAddress(address: `0x${string}`): Promise<CityBuilding> {
  const [balanceWei, txCount, code] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getTransactionCount({ address }),
    publicClient.getBytecode({ address }),
  ]);

  const balanceEth = parseFloat(formatEther(balanceWei));
  const isContract = !!code && code !== "0x";

  let type: BuildingType;
  let height: number;
  let complexity: number;

  if (isContract) {
    // Contracts: guess DAO/office vs generic factory by code size (rough heuristic)
    const codeSize = code ? (code.length - 2) / 2 : 0;
    if (codeSize > 20000) {
      type = "office"; // big, complex contract -> looks like DAO/governance
      complexity = 5;
      height = Math.min(10, 4 + Math.floor(codeSize / 8000));
    } else {
      type = "factory";
      complexity = 3;
      height = Math.min(10, 3 + Math.floor(codeSize / 4000));
    }
  } else if (balanceEth === 0 && txCount === 0) {
    type = "ruin";
    height = 1;
    complexity = 1;
  } else if (balanceEth >= WHALE_ETH) {
    type = "tower";
    height = Math.min(10, 6 + Math.floor(Math.log2(balanceEth / WHALE_ETH + 1)));
    complexity = 5;
  } else if (txCount >= ACTIVE_TX) {
    type = "shop";
    height = Math.min(8, 3 + Math.floor(txCount / 300));
    complexity = 3;
  } else if (balanceEth > 0 || txCount > 0) {
    type = "house";
    height = Math.min(5, 2 + Math.floor(balanceEth));
    complexity = 2;
  } else {
    type = "ruin";
    height = 1;
    complexity = 1;
  }

  return {
    address,
    type,
    balanceEth,
    txCount,
    isContract,
    height,
    complexity,
    lastSeen: Date.now(),
  };
}

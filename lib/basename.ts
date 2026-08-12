import { createPublicClient, http, toCoinType } from "viem";
import { mainnet, base } from "viem/chains";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.MAINNET_RPC_URL || "https://eth.llamarpc.com"),
});

const cache = new Map<string, { value: string | null; at: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 min

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]) as Promise<T | null>;
}

/** Resolve an address's primary Basename (Base's onchain name system), not .eth ENS. */
export async function resolveBasename(address: string): Promise<string | null> {
  const key = address.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value;

  let name: string | null = null;
  try {
    name = await withTimeout(
      mainnetClient.getEnsName({
        address: key as `0x${string}`,
        coinType: toCoinType(base.id),
      }),
      4500
    );
  } catch {
    name = null;
  }

  cache.set(key, { value: name, at: Date.now() });
  return name;
}

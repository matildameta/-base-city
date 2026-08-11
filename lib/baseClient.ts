import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// Free public Base RPC. Swap for Alchemy/Infura URL in .env (BASE_RPC_URL) for heavier traffic.
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

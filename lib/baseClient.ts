import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// Free public Base RPC. Set BASE_RPC_URL (Alchemy/Infura/QuickNode) in .env / Vercel
// for higher rate limits — see README.
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

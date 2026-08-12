// ETH spot price (USD) from Coinbase — cached, best-effort.
let cached: { value: number | null; at: number } = { value: null, at: 0 };
const TTL = 1000 * 60 * 5; // 5 min

export async function ethUsdPrice(): Promise<number | null> {
  if (cached.value !== null && Date.now() - cached.at < TTL) return cached.value;
  try {
    const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
      next: { revalidate: 300 } as never,
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const price = parseFloat(json?.data?.amount);
    cached = { value: Number.isFinite(price) ? price : null, at: Date.now() };
    return cached.value;
  } catch {
    return cached.value;
  }
}

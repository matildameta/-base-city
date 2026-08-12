// Farcaster identity resolution via Neynar (bulk-by-address).
// Set NEYNAR_API_KEY in .env.local (local) and in Vercel env (prod).

export interface FarcasterProfile {
  fid: number;
  username: string;
  displayName: string | null;
  pfpUrl: string | null;
  followerCount: number;
  followingCount: number;
  bio: string | null;
  powerBadge: boolean;
}

const cache = new Map<string, { value: FarcasterProfile | null; at: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 min

const API = "https://api.neynar.com/v2/farcaster/user/bulk-by-address";

function mapUser(u: Record<string, any>): FarcasterProfile {
  return {
    fid: u.fid,
    username: u.username,
    displayName: u.display_name ?? null,
    pfpUrl: u.pfp_url ?? null,
    followerCount: u.follower_count ?? 0,
    followingCount: u.following_count ?? 0,
    bio: u.profile?.bio?.text ?? null,
    powerBadge: !!u.power_badge,
  };
}

/** Resolve Farcaster profiles for many addresses in one request. Returns a lowercased-address map. */
export async function resolveFarcasterBulk(
  addresses: string[]
): Promise<Record<string, FarcasterProfile | null>> {
  const key = process.env.NEYNAR_API_KEY;
  const out: Record<string, FarcasterProfile | null> = {};
  if (!key || addresses.length === 0) return out;

  // serve cached, collect misses
  const now = Date.now();
  const misses: string[] = [];
  for (const a of addresses) {
    const lc = a.toLowerCase();
    const c = cache.get(lc);
    if (c && now - c.at < CACHE_TTL) out[lc] = c.value;
    else misses.push(lc);
  }
  if (misses.length === 0) return out;

  try {
    // Neynar allows up to 350 addresses per call.
    const url = `${API}?addresses=${misses.join(",")}&address_types=verified_address,custody_address`;
    const res = await fetch(url, {
      headers: { "x-api-key": key, accept: "application/json" },
      // revalidate at the network layer too
      next: { revalidate: 300 } as any,
    });
    if (!res.ok) throw new Error(String(res.status));
    const json: Record<string, any[]> = await res.json();
    for (const lc of misses) {
      const arr = json[lc] || json[lc.toLowerCase()];
      const profile = Array.isArray(arr) && arr.length ? mapUser(arr[0]) : null;
      cache.set(lc, { value: profile, at: now });
      out[lc] = profile;
    }
  } catch {
    for (const lc of misses) {
      if (!(lc in out)) out[lc] = null;
    }
  }
  return out;
}

/** Resolve a single address's Farcaster profile. */
export async function resolveFarcaster(address: string): Promise<FarcasterProfile | null> {
  const map = await resolveFarcasterBulk([address]);
  return map[address.toLowerCase()] ?? null;
}

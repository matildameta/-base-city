import { CityBuilding } from "./classify";

const KEY = "basecity:buildings";

// In-memory fallback (resets on cold start — fine for local dev / demo).
// eslint-disable-next-line no-var
declare global {
  // eslint-disable-next-line no-var
  var __basecity_memory: Record<string, CityBuilding> | undefined;
}
const memory = globalThis.__basecity_memory || (globalThis.__basecity_memory = {});

function upstashConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstash(command: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  return res.json();
}

export async function saveBuilding(building: CityBuilding) {
  if (upstashConfigured()) {
    await upstash(["HSET", KEY, building.address.toLowerCase(), JSON.stringify(building)]);
    return;
  }
  memory[building.address.toLowerCase()] = building;
}

export async function getCity(): Promise<CityBuilding[]> {
  if (upstashConfigured()) {
    const result = await upstash(["HGETALL", KEY]);
    const arr: string[] = result?.result || [];
    const buildings: CityBuilding[] = [];
    for (let i = 1; i < arr.length; i += 2) {
      try {
        buildings.push(JSON.parse(arr[i]));
      } catch {
        /* skip malformed */
      }
    }
    return buildings;
  }
  return Object.values(memory);
}

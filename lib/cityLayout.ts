import type { CityBuilding, Zone } from "./classify";

export interface PositionedItem {
  building: CityBuilding;
  x: number; // world x (center-bottom anchor)
}

export interface ZoneRange {
  zone: Zone;
  label: string;
  start: number;
  end: number;
}

export interface GenesisFeature {
  type: "park" | "river" | "city_hall";
  x: number;
  width: number;
}

const ZONE_LABEL: Record<Zone, string> = {
  wasteland: "The Outskirts",
  residential: "Residential District",
  commercial: "Market Street",
  downtown: "Downtown & Civic Center",
  industrial: "Industrial Zone",
};

const MIN_WIDTH: Record<Zone, number> = {
  wasteland: 560,
  residential: 680,
  commercial: 680,
  downtown: 820,
  industrial: 620,
};

const SPACING = 150;
const PADDING = 90;
const PARK_WIDTH = 420;
const RIVER_WIDTH = 300;

export interface CityLayout {
  positioned: PositionedItem[];
  zoneRanges: ZoneRange[];
  genesis: GenesisFeature[];
  worldWidth: number;
  groundY: number;
}

function seededJitter(address: string) {
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) & 0xffffff;
  return ((h % 100) / 100 - 0.5) * 40;
}

export function computeCityLayout(buildings: CityBuilding[]): CityLayout {
  const byZone: Record<Zone, CityBuilding[]> = {
    wasteland: [],
    residential: [],
    commercial: [],
    downtown: [],
    industrial: [],
  };
  for (const b of buildings) {
    byZone[b.zone].push(b);
  }
  (Object.keys(byZone) as Zone[]).forEach((z) =>
    byZone[z].sort((a, b) => a.claimedAt - b.claimedAt)
  );

  const positioned: PositionedItem[] = [];
  const zoneRanges: ZoneRange[] = [];
  const genesis: GenesisFeature[] = [];

  let x = 0;
  const order: Zone[] = ["wasteland", "residential", "commercial", "downtown", "industrial"];

  for (const zone of order) {
    const list = byZone[zone];
    const width = Math.max(MIN_WIDTH[zone], list.length * SPACING + PADDING * 2);
    const start = x;
    const end = x + width;

    if (zone === "downtown") {
      genesis.push({ type: "city_hall", x: start + 150, width: 220 });
    }

    list.forEach((b, i) => {
      const bx = start + PADDING + (zone === "downtown" ? 380 : 0) + i * SPACING + seededJitter(b.address);
      positioned.push({ building: b, x: bx });
    });

    zoneRanges.push({ zone, label: ZONE_LABEL[zone], start, end });
    x = end;

    if (zone === "residential") {
      genesis.push({ type: "park", x, width: PARK_WIDTH });
      x += PARK_WIDTH;
    }
    if (zone === "commercial") {
      genesis.push({ type: "river", x, width: RIVER_WIDTH });
      x += RIVER_WIDTH;
    }
  }

  return { positioned, zoneRanges, genesis, worldWidth: x, groundY: 0 };
}

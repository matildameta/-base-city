import { formatEther } from "viem";
import { publicClient } from "./baseClient";

export type Zone = "wasteland" | "residential" | "commercial" | "downtown" | "industrial";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ItemType =
  // wasteland — dead / dust wallets
  | "ruin" | "abandoned_lot" | "trash_pile" | "trash_can" | "old_bench"
  | "cracked_road" | "dead_tree" | "rubble" | "broken_car" | "scrap_tent"
  // residential — holders
  | "cottage" | "small_house" | "house" | "townhouse" | "duplex" | "bungalow"
  | "apartment" | "loft" | "garden_villa" | "mansion" | "villa" | "penthouse"
  // commercial — traders
  | "kiosk" | "market_stall" | "cafe" | "boutique" | "shop"
  | "supermarket" | "arcade" | "hotel" | "mall" | "trading_floor"
  // downtown — whales & DAOs
  | "office" | "courthouse" | "museum" | "embassy" | "tower" | "hq_tower"
  | "dao_hall" | "exchange" | "bank_vault" | "skyscraper" | "spire" | "observatory"
  // industrial — active contracts
  | "workshop" | "warehouse" | "factory" | "shipyard"
  | "refinery" | "power_plant" | "solar_farm" | "data_center";

export interface ItemMeta {
  label: string;
  zone: Zone;
  emoji: string;
  tier: number; // 0..5 relative prestige
  accent: string; // hex — drives UI glow / reveal color
}

export const ITEM_META: Record<ItemType, ItemMeta> = {
  // wasteland
  ruin: { label: "Ruined Lot", zone: "wasteland", emoji: "🪦", tier: 0, accent: "#6b7280" },
  abandoned_lot: { label: "Abandoned Lot", zone: "wasteland", emoji: "🕳️", tier: 0, accent: "#5c5348" },
  trash_pile: { label: "Trash Pile", zone: "wasteland", emoji: "🗑️", tier: 0, accent: "#6b6152" },
  trash_can: { label: "Lonely Bin", zone: "wasteland", emoji: "🚮", tier: 0, accent: "#5f6b7a" },
  old_bench: { label: "Broken Bench", zone: "wasteland", emoji: "🪑", tier: 0, accent: "#6b5a4a" },
  cracked_road: { label: "Cracked Road", zone: "wasteland", emoji: "🛣️", tier: 0, accent: "#4a4a4a" },
  dead_tree: { label: "Dead Tree", zone: "wasteland", emoji: "🥀", tier: 0, accent: "#6b5a3a" },
  rubble: { label: "Rubble Heap", zone: "wasteland", emoji: "🧱", tier: 0, accent: "#7a6a5a" },
  broken_car: { label: "Wrecked Car", zone: "wasteland", emoji: "🚗", tier: 1, accent: "#7a4a4a" },
  scrap_tent: { label: "Scrap Tent", zone: "wasteland", emoji: "⛺", tier: 1, accent: "#7a7050" },
  // residential
  cottage: { label: "Cottage", zone: "residential", emoji: "🏚️", tier: 1, accent: "#c9a877" },
  small_house: { label: "Small House", zone: "residential", emoji: "🏠", tier: 1, accent: "#b98d6b" },
  house: { label: "House", zone: "residential", emoji: "🏡", tier: 1, accent: "#5b82c4" },
  townhouse: { label: "Townhouse", zone: "residential", emoji: "🏘️", tier: 2, accent: "#c46b3a" },
  duplex: { label: "Duplex", zone: "residential", emoji: "🏘️", tier: 2, accent: "#6b8ac4" },
  bungalow: { label: "Bungalow", zone: "residential", emoji: "🛖", tier: 1, accent: "#a8946b" },
  apartment: { label: "Apartments", zone: "residential", emoji: "🏢", tier: 2, accent: "#6f8fb5" },
  loft: { label: "Modern Loft", zone: "residential", emoji: "🏙️", tier: 3, accent: "#8a7ab5" },
  garden_villa: { label: "Garden Villa", zone: "residential", emoji: "🏡", tier: 3, accent: "#56b47d" },
  mansion: { label: "Mansion", zone: "residential", emoji: "🏛️", tier: 3, accent: "#e8dfc8" },
  villa: { label: "Grand Villa", zone: "residential", emoji: "🏰", tier: 4, accent: "#f0e6d2" },
  penthouse: { label: "Penthouse", zone: "residential", emoji: "🌆", tier: 4, accent: "#b58bff" },
  // commercial
  kiosk: { label: "Street Kiosk", zone: "commercial", emoji: "🛒", tier: 2, accent: "#e8c04a" },
  market_stall: { label: "Market Stall", zone: "commercial", emoji: "🎪", tier: 2, accent: "#c9432a" },
  cafe: { label: "Corner Café", zone: "commercial", emoji: "☕", tier: 2, accent: "#c98a4a" },
  boutique: { label: "Boutique", zone: "commercial", emoji: "👗", tier: 2, accent: "#d46b9a" },
  shop: { label: "Shop", zone: "commercial", emoji: "🏪", tier: 2, accent: "#e08b52" },
  supermarket: { label: "Supermarket", zone: "commercial", emoji: "🛍️", tier: 3, accent: "#4fae7a" },
  arcade: { label: "Arcade", zone: "commercial", emoji: "🕹️", tier: 3, accent: "#7c5cff" },
  hotel: { label: "Hotel", zone: "commercial", emoji: "🏨", tier: 3, accent: "#4fb2ff" },
  mall: { label: "Shopping Mall", zone: "commercial", emoji: "🏬", tier: 3, accent: "#4fc9ae" },
  trading_floor: { label: "Trading Floor", zone: "commercial", emoji: "📈", tier: 4, accent: "#7cf7c4" },
  // downtown
  office: { label: "Office Building", zone: "downtown", emoji: "🏢", tier: 3, accent: "#2f8f7a" },
  courthouse: { label: "Courthouse", zone: "downtown", emoji: "⚖️", tier: 4, accent: "#e2ded1" },
  museum: { label: "Museum", zone: "downtown", emoji: "🏛️", tier: 4, accent: "#d8c9a0" },
  embassy: { label: "Embassy", zone: "downtown", emoji: "🏳️", tier: 4, accent: "#e9edf7" },
  tower: { label: "Tower", zone: "downtown", emoji: "🗼", tier: 4, accent: "#9b7bff" },
  hq_tower: { label: "HQ Tower", zone: "downtown", emoji: "🏢", tier: 4, accent: "#4fb2ff" },
  dao_hall: { label: "DAO Hall", zone: "downtown", emoji: "🏛️", tier: 5, accent: "#2f6fed" },
  exchange: { label: "The Exchange", zone: "downtown", emoji: "💹", tier: 5, accent: "#ffcf5c" },
  bank_vault: { label: "Bank & Vault", zone: "downtown", emoji: "🏦", tier: 5, accent: "#d4af37" },
  skyscraper: { label: "Skyscraper", zone: "downtown", emoji: "🌃", tier: 5, accent: "#9b7bff" },
  spire: { label: "The Spire", zone: "downtown", emoji: "🗼", tier: 5, accent: "#7c5cff" },
  observatory: { label: "Observatory", zone: "downtown", emoji: "🔭", tier: 4, accent: "#6fb5ff" },
  // industrial
  workshop: { label: "Workshop", zone: "industrial", emoji: "🔧", tier: 2, accent: "#8a8f96" },
  warehouse: { label: "Warehouse", zone: "industrial", emoji: "📦", tier: 2, accent: "#9aa0a6" },
  factory: { label: "Factory", zone: "industrial", emoji: "🏭", tier: 3, accent: "#7a8590" },
  shipyard: { label: "Shipyard", zone: "industrial", emoji: "⚓", tier: 3, accent: "#4f8fb2" },
  refinery: { label: "Refinery", zone: "industrial", emoji: "⛽", tier: 3, accent: "#b58a4a" },
  power_plant: { label: "Power Plant", zone: "industrial", emoji: "⚡", tier: 4, accent: "#8a94a0" },
  solar_farm: { label: "Solar Farm", zone: "industrial", emoji: "☀️", tier: 3, accent: "#ffcf5c" },
  data_center: { label: "Data Center", zone: "industrial", emoji: "🖥️", tier: 4, accent: "#4fd0c9" },
};

export const RARITY_META: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Common", color: "#8b97ad" },
  uncommon: { label: "Uncommon", color: "#4fae7a" },
  rare: { label: "Rare", color: "#4fb2ff" },
  epic: { label: "Epic", color: "#b58bff" },
  legendary: { label: "Legendary", color: "#ffcf5c" },
};

export interface CityBuilding {
  address: string;
  itemType: ItemType;
  zone: Zone;
  balanceEth: number;
  txCount: number;
  isContract: boolean;
  scale: number; // 0.7 - 1.6, drives visual size within its item type
  claimedAt: number; // 0 = not yet minted (preview only)
  basename?: string | null;
}

export function rarityOf(b: Pick<CityBuilding, "itemType" | "balanceEth" | "txCount">): Rarity {
  const tier = ITEM_META[b.itemType].tier;
  if (tier >= 5 || b.balanceEth >= 100) return "legendary";
  if (tier >= 4 || b.balanceEth >= 10) return "epic";
  if (tier >= 3 || b.balanceEth >= 1 || b.txCount >= TX_BUSY) return "rare";
  if (tier >= 2 || b.txCount >= TX_MODEST) return "uncommon";
  return "common";
}

function seeded(address: string) {
  let h = 0;
  for (let i = 0; i < address.length; i++) {
    h = (h << 5) - h + address.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pick<T>(seed: number, options: T[]): T {
  return options[seed % options.length];
}

const WHALE_ETH = 10;
const MEGA_WHALE_ETH = 100;
const DUST_ETH = 0.0005;

// Activity (transaction-count) ladder for EOAs. Deliberately strict — a couple
// hundred transactions is an ordinary wallet, not a landmark. A genuinely busy
// wallet ("a good building") starts in the thousands, and the elite trading
// floors want 2500+ meaningful transactions.
const TX_ELITE = 2500; // trading floor / mall — top-tier trader
const TX_BUSY = 1000; // supermarket / hotel — clearly a good building
const TX_ACTIVE = 400; // shop / boutique — established
const TX_MODEST = 150; // kiosk / stall / café — small commercial

export async function classifyAddress(address: `0x${string}`): Promise<CityBuilding> {
  const [balanceWei, txCount, code] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getTransactionCount({ address }),
    publicClient.getBytecode({ address }),
  ]);

  const balanceEth = parseFloat(formatEther(balanceWei));
  const isContract = !!code && code !== "0x";
  const seed = seeded(address);

  let itemType: ItemType;
  let scale = 0.85 + (seed % 100) / 200; // 0.85 - 1.35 base variance

  if (isContract) {
    const codeSize = code ? (code.length - 2) / 2 : 0;
    if (codeSize > 20000) {
      itemType = pick(seed, ["dao_hall", "exchange", "embassy", "museum"]);
      scale += 0.3;
    } else if (codeSize > 10000) {
      itemType = pick(seed, ["office", "hq_tower", "courthouse", "observatory"]);
      scale += 0.2;
    } else if (codeSize > 6000) {
      itemType = pick(seed, ["factory", "refinery", "data_center", "power_plant"]);
      scale += 0.15;
    } else {
      itemType = pick(seed, ["workshop", "warehouse", "shipyard", "solar_farm"]);
    }
  } else if (balanceEth === 0 && txCount === 0) {
    itemType = pick(seed, ["ruin", "abandoned_lot", "rubble", "cracked_road", "dead_tree"]);
  } else if (balanceEth > 0 && balanceEth < DUST_ETH && txCount < 3) {
    itemType = pick(seed, ["trash_can", "old_bench", "trash_pile", "broken_car", "scrap_tent"]);
  } else if (balanceEth >= MEGA_WHALE_ETH) {
    itemType = pick(seed, ["skyscraper", "spire", "bank_vault"]);
    scale += 0.4;
  } else if (balanceEth >= WHALE_ETH) {
    itemType = pick(seed, ["tower", "hq_tower", "bank_vault", "penthouse"]);
    scale += 0.25;
  } else if (txCount >= TX_ELITE) {
    itemType = pick(seed, ["trading_floor", "mall", "arcade"]);
    scale += 0.2;
  } else if (txCount >= TX_BUSY) {
    itemType = pick(seed, ["supermarket", "hotel", "arcade"]);
    scale += 0.12;
  } else if (txCount >= TX_ACTIVE) {
    itemType = pick(seed, ["shop", "boutique", "cafe"]);
    scale += 0.05;
  } else if (txCount >= TX_MODEST) {
    itemType = pick(seed, ["kiosk", "market_stall", "cafe"]);
  } else if (balanceEth >= 1) {
    itemType = pick(seed, ["mansion", "villa", "penthouse", "garden_villa"]);
    scale += 0.1;
  } else if (balanceEth >= 0.05 || txCount >= 5) {
    itemType = pick(seed, ["house", "townhouse", "duplex", "apartment", "loft"]);
  } else {
    itemType = pick(seed, ["cottage", "small_house", "bungalow"]);
  }

  return {
    address: address.toLowerCase(),
    itemType,
    zone: ITEM_META[itemType].zone,
    balanceEth,
    txCount,
    isContract,
    scale: Math.min(1.6, Math.max(0.7, scale)),
    claimedAt: 0,
  };
}

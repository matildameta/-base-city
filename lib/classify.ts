import { formatEther } from "viem";
import { publicClient } from "./baseClient";

export type Zone = "wasteland" | "residential" | "commercial" | "downtown" | "industrial";

export type ItemType =
  // wasteland — dead / dust wallets
  | "ruin"
  | "abandoned_lot"
  | "trash_pile"
  | "trash_can"
  | "old_bench"
  // residential — holders
  | "cottage"
  | "small_house"
  | "house"
  | "townhouse"
  | "mansion"
  | "villa"
  // commercial — traders
  | "kiosk"
  | "market_stall"
  | "shop"
  | "mall"
  | "trading_floor"
  // downtown — whales & DAOs
  | "tower"
  | "skyscraper"
  | "bank_vault"
  | "office"
  | "dao_hall"
  | "courthouse"
  // industrial — active contracts
  | "workshop"
  | "warehouse"
  | "factory"
  | "power_plant";

export interface ItemMeta {
  label: string;
  zone: Zone;
}

export const ITEM_META: Record<ItemType, ItemMeta> = {
  ruin: { label: "Ruined Lot", zone: "wasteland" },
  abandoned_lot: { label: "Abandoned Lot", zone: "wasteland" },
  trash_pile: { label: "Trash Pile", zone: "wasteland" },
  trash_can: { label: "Trash Can", zone: "wasteland" },
  old_bench: { label: "Broken Bench", zone: "wasteland" },
  cottage: { label: "Cottage", zone: "residential" },
  small_house: { label: "Small House", zone: "residential" },
  house: { label: "House", zone: "residential" },
  townhouse: { label: "Townhouse", zone: "residential" },
  mansion: { label: "Mansion", zone: "residential" },
  villa: { label: "Villa", zone: "residential" },
  kiosk: { label: "Street Kiosk", zone: "commercial" },
  market_stall: { label: "Market Stall", zone: "commercial" },
  shop: { label: "Shop", zone: "commercial" },
  mall: { label: "Shopping Mall", zone: "commercial" },
  trading_floor: { label: "Trading Floor", zone: "commercial" },
  tower: { label: "Tower", zone: "downtown" },
  skyscraper: { label: "Skyscraper", zone: "downtown" },
  bank_vault: { label: "Bank & Vault", zone: "downtown" },
  office: { label: "Office Building", zone: "downtown" },
  dao_hall: { label: "DAO Hall", zone: "downtown" },
  courthouse: { label: "Courthouse", zone: "downtown" },
  workshop: { label: "Workshop", zone: "industrial" },
  warehouse: { label: "Warehouse", zone: "industrial" },
  factory: { label: "Factory", zone: "industrial" },
  power_plant: { label: "Power Plant", zone: "industrial" },
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
      itemType = pick(seed, ["dao_hall", "office", "courthouse"]);
      scale += 0.3;
    } else if (codeSize > 6000) {
      itemType = pick(seed, ["factory", "power_plant"]);
      scale += 0.15;
    } else {
      itemType = pick(seed, ["workshop", "warehouse"]);
    }
  } else if (balanceEth === 0 && txCount === 0) {
    itemType = pick(seed, ["ruin", "abandoned_lot", "trash_pile"]);
  } else if (balanceEth > 0 && balanceEth < DUST_ETH && txCount < 3) {
    itemType = pick(seed, ["trash_can", "old_bench"]);
  } else if (balanceEth >= MEGA_WHALE_ETH) {
    itemType = pick(seed, ["skyscraper", "bank_vault"]);
    scale += 0.4;
  } else if (balanceEth >= WHALE_ETH) {
    itemType = pick(seed, ["tower", "skyscraper", "bank_vault"]);
    scale += 0.25;
  } else if (txCount >= 300) {
    itemType = pick(seed, ["mall", "trading_floor"]);
    scale += 0.15;
  } else if (txCount >= 50) {
    itemType = pick(seed, ["shop", "market_stall", "kiosk"]);
  } else if (balanceEth >= 1) {
    itemType = pick(seed, ["mansion", "villa"]);
    scale += 0.1;
  } else if (balanceEth >= 0.05 || txCount >= 5) {
    itemType = pick(seed, ["house", "townhouse"]);
  } else {
    itemType = pick(seed, ["cottage", "small_house"]);
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

# 🏙️ Base City

A full-screen, zoomable, pannable living city built from Base on-chain activity.
Every wallet address becomes one of **52 distinct buildings**, placed in the right district. Minting
a plot is a real transaction on Base — once minted, you have a permanent spot in the shared city,
visible to everyone, forever.

Owners are shown by their **Farcaster** profile (name + avatar, via Neynar) or their **Basename**,
falling back to a shortened address. Click any building to see who it is, their balance (with a live
USD estimate), activity, rarity and a link to Basescan.

Built as a Farcaster Mini App / Base App, ready to deploy on Vercel.

## How it decides what you become

Your wallet is read live from a free public Base RPC (balance, tx count, whether it's a contract)
and mapped into a district + item. Each category has 2–3 visual variants (chosen deterministically
from your address) so not everyone in the same tier looks identical:

| District | Who ends up there | Example buildings (of 52) |
|---|---|---|
| 🪦 The Outskirts | Dead / dust wallets | Ruined Lot, Abandoned Lot, Trash Pile, Broken Bench, Cracked Road, Dead Tree, Rubble, Wrecked Car, Scrap Tent |
| 🏡 Residential | ETH holders | Cottage, Small House, House, Townhouse, Duplex, Bungalow, Apartments, Loft, Garden Villa, Mansion, Grand Villa, Penthouse |
| 🏪 Market Street | Frequent traders | Kiosk, Market Stall, Café, Boutique, Shop, Supermarket, Arcade, Hotel, Mall, Trading Floor |
| 🏛️ Downtown & Civic | Whales & large contracts (DAOs) | Office, Courthouse, Museum, Embassy, Tower, HQ Tower, DAO Hall, Exchange, Bank & Vault, Skyscraper, Spire, Observatory |
| 🏭 Industrial | Active contracts / dapps | Workshop, Warehouse, Factory, Shipyard, Refinery, Power Plant, Solar Farm, Data Center |

The city also ships with **genesis landmarks** that are always there regardless of users: a City
Hall, a park with a fountain and trees, a river with a bridge, street lights, and a road running
through the whole city — so it never feels empty, and it's clear the "land" is Base's, while
citizens build it up.

## The mint flow

1. Enter (or connect) a wallet address → the app classifies it and shows a **preview** of the item
   with its stats, without saving anything yet.
2. Click **Mint this item on Base** → sends a real `claimPlot()` transaction to a small on-chain
   registry contract from the connected wallet.
3. Once confirmed, the backend verifies the transaction on-chain (sender, recipient, success) and
   permanently saves the building — it now appears in the shared city and on the leaderboard for
   everyone, forever tied to that address.
4. Names shown are **Basenames** (Base's own name system), not `.eth` — resolved via ENSIP-19,
   with a graceful fallback to a shortened address if none is set.

## Controls

- **Scroll / pinch** to zoom, **drag** to pan across the whole city.
- Click any building to see its stats.
- 🏆 **Leaderboard** (top right) lists only wallets that have actually minted, ranked by on-chain
  activity.

---

## 1) Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Works with zero env vars (public Base RPC + in-memory city storage —
minting will just need the registry contract, see step 4 below).

---

## 2) Deploy on Vercel

1. Push this folder to a GitHub repo.
2. vercel.com → New Project → import the repo → Deploy.
3. After the first deploy, set in Vercel → Settings → Environment Variables:
   - `NEXT_PUBLIC_APP_URL` = your deployed URL, e.g. `https://base-city.vercel.app`
4. Redeploy so the new env var takes effect.

Strongly recommended so the city is shared/persistent across all visitors (otherwise it can reset
on Vercel serverless cold starts):
   - Create a free Upstash Redis database: https://upstash.com
   - Copy the REST URL + token into `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` in Vercel.

Optional:
   - `NEYNAR_API_KEY` — enables Farcaster names + avatars on the leaderboard and info cards
     (get a free key at https://neynar.com). Without it, owners fall back to Basename / address.
   - `ETHERSCAN_API_KEY` — powers the full 30-metric wallet analytics panel (wallet age, gas spent,
     streaks, token diversity, on-chain score, and more). One free Etherscan V2 key covers Base —
     get it at https://etherscan.io/myapikey. Without it the panel is simply hidden.
   - `BASE_RPC_URL` — your own Base RPC (Alchemy/Infura/etc.) for higher rate limits than the free
     public one.
   - `MAINNET_RPC_URL` — a mainnet RPC used only for Basename lookups (ENSIP-19 resolution starts
     on L1). Defaults to a public one; a private RPC resolves faster and more reliably.

---

## 3) Publish as a Farcaster Mini App / Base App

1. Add real images to `public/`: `icon.png` (1024×1024), `og.png` (1200×630), `splash.png`
   (200×200).
2. Edit `public/.well-known/farcaster.json` and replace every `your-app.vercel.app` reference with
   your real Vercel domain.
3. Sign the manifest: Warpcast → Settings → Developer → Mini Apps → "Create manifest" (or see
   https://miniapps.farcaster.xyz/docs/guides/publishing). Paste the resulting `header` / `payload`
   / `signature` into `farcaster.json`.
4. Push and redeploy.
5. Paste your app's link into a cast — it should render the Mini App embed with an
   "🏙️ Open Base City" button.

---

## 4) Deploy the on-chain registry (required to actually mint)

`contracts/BaseCityRegistry.sol` is a minimal contract: calling `claimPlot()` records the caller's
address as a permanent citizen, with a real transaction on Base.

**Easiest path — Remix, no local tooling needed:**

1. Open https://remix.ethereum.org
2. Paste in `BaseCityRegistry.sol`.
3. Solidity Compiler tab → Compile.
4. Deploy & Run tab → Environment → "Injected Provider", connect your wallet to **Base Mainnet**
   (chain ID 8453) — or **Base Sepolia** for testing.
5. Deploy, confirm the transaction, copy the deployed contract address.
6. In Vercel, set:
   - `NEXT_PUBLIC_REGISTRY_ADDRESS = 0x...`
7. Redeploy. The "Mint this item on Base" button now sends real transactions to your registry, and
   `/api/claim` verifies each one on-chain before adding it to the shared city.

> For a production launch, test the contract with Foundry/Hardhat and verify it on Basescan — for
> a demo / Farcaster launch this is enough.

---

## Free RPC + Neynar setup (recommended for production)

The app works out of the box on the public Base RPC, but that endpoint is rate-limited and will be
slow/unreliable under real traffic. For a launch, add your own — both are free:

**Base RPC (Alchemy):**
1. Sign up at https://alchemy.com → Create App → Chain: **Base**, Network: **Base Mainnet**.
2. Copy the HTTPS URL (looks like `https://base-mainnet.g.alchemy.com/v2/XXXX`).
3. In Vercel → Settings → Environment Variables, set `BASE_RPC_URL` to that URL, then redeploy.
   (Optional: create a **Base Sepolia** app too and use it while testing.)

**Farcaster names (Neynar):**
1. Sign up at https://neynar.com and copy your API key.
2. In Vercel, set `NEYNAR_API_KEY` to that key, then redeploy.

Keep both keys **only in environment variables** — never commit them. Locally they live in
`.env.local` (gitignored). If a key was ever pasted in plaintext (chat, screenshot, commit), rotate
it in the provider dashboard.

---

## Project structure

```
app/
  page.tsx                 Full-screen UI: search/preview/mint, leaderboard, zoom controls
  layout.tsx                Mini App / Open Graph metadata
  api/analyze/route.ts       Classify an address (preview only, not saved) + identity + ETH price
  api/claim/route.ts         Verify a claimPlot() tx on-chain, then permanently save the building
  api/city/route.ts          Return all minted buildings (shared city + leaderboard source)
  api/basename/route.ts      On-demand Basename lookup
  api/farcaster/route.ts     Bulk Farcaster (Neynar) lookup for leaderboard rows
  api/profile/route.ts       Owner identity (Basename + Farcaster) + live ETH price for a plot
  plot/[address]/            Shareable deep link + dynamic Open Graph image
  icon.tsx / apple-icon.tsx  Generated favicon / touch icon
components/
  CityCanvas.tsx             Full-screen zoom/pan renderer, 52 building types, day/night + weather
lib/
  classify.ts                On-chain data → district + building type + variant
  cityLayout.ts               Lays out minted buildings into districts along a scrollable world
  basename.ts                  Basename (ENSIP-19) resolution with cache + timeout fallback
  neynar.ts                    Farcaster identity resolution (Neynar bulk-by-address)
  price.ts                     Cached ETH/USD spot price (Coinbase)
  store.ts                     Shared storage (Upstash Redis if configured, else in-memory)
  baseClient.ts                Base RPC client
contracts/
  BaseCityRegistry.sol           On-chain registry — claimPlot() records permanent ownership
public/.well-known/farcaster.json  Mini App manifest
```

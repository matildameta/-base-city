# 🏙️ Base City

A full-screen, zoomable, pannable living city built from Base on-chain activity.
Every wallet address becomes one of **24 distinct items**, placed in the right district. Minting
an item is a real transaction on Base — once minted, you have a permanent spot in the shared city,
visible to everyone, forever.

Built as a Farcaster Mini App / Base App, ready to deploy on Vercel.

## How it decides what you become

Your wallet is read live from a free public Base RPC (balance, tx count, whether it's a contract)
and mapped into a district + item. Each category has 2–3 visual variants (chosen deterministically
from your address) so not everyone in the same tier looks identical:

| District | Who ends up there | Items |
|---|---|---|
| 🪦 The Outskirts | Dead / dust wallets | Ruined Lot, Abandoned Lot, Trash Pile, Trash Can, Broken Bench |
| 🏡 Residential | ETH holders | Cottage, Small House, House, Townhouse, Mansion, Villa |
| 🏪 Market Street | Frequent traders | Street Kiosk, Market Stall, Shop, Shopping Mall, Trading Floor |
| 🏛️ Downtown & Civic | Whales & large contracts (DAOs) | Tower, Skyscraper, Bank & Vault, Office, DAO Hall, Courthouse |
| 🏭 Industrial | Active contracts / dapps | Workshop, Warehouse, Factory, Power Plant |

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
   - `BASE_RPC_URL` — your own Base RPC (Alchemy/Infura/etc.) for higher rate limits than the free
     public one.
   - `MAINNET_RPC_URL` — a mainnet RPC used only for Basename lookups (ENSIP-19 resolution starts
     on L1). Defaults to a public one; a private RPC resolves faster and more reliably.
   - `BASESCAN_API_KEY` — reserved for future richer heuristics, not required today.

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

## About the API key you shared

That key belongs to a Telegram bot (EtherDrops), used for transaction notifications — it isn't a
documented public API for this use case, and since it's tied to your account it's best not to put
it in code that ends up in a public repo. This app doesn't need it: it reads directly from Base's
public RPC. If you later want richer signals (e.g. more precise trader/DAO detection from token
transfer history), better free options are the Basescan API (free with an API key) or Alchemy's
free tier.

---

## Project structure

```
app/
  page.tsx                 Full-screen UI: search/preview/mint, leaderboard, zoom controls
  layout.tsx                Mini App / Open Graph metadata
  api/analyze/route.ts       Classify an address (preview only, not saved)
  api/claim/route.ts         Verify a claimPlot() tx on-chain, then permanently save the building
  api/city/route.ts          Return all minted buildings (shared city + leaderboard source)
  api/basename/route.ts      On-demand Basename lookup
components/
  CityCanvas.tsx             Full-screen zoom/pan renderer, 24 item types + genesis landmarks
lib/
  classify.ts                On-chain data → district + item type + variant
  cityLayout.ts               Lays out minted items into districts along a scrollable world
  basename.ts                  Basename (ENSIP-19) resolution with cache + timeout fallback
  store.ts                     Shared storage (Upstash Redis if configured, else in-memory)
  baseClient.ts                 Base RPC client
contracts/
  BaseCityRegistry.sol           On-chain registry — claimPlot() records permanent ownership
public/.well-known/farcaster.json  Mini App manifest
```

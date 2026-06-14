# Splyt off-chain scripts

TypeScript scripts for the contracts-owner track: the DeepBook listing/seed/trade
tooling and (next) the Walrus yield-curve writer. Frontend is a separate track.

- `@mysten/sui` **v2** (note: v2 moved the client to `@mysten/sui/jsonRpc` —
  `SuiJsonRpcClient` / `getJsonRpcFullnodeUrl`, not the old `SuiClient`).
- `@mysten/deepbook-v3` for `DeepBookClient`.
- `@mysten/walrus` + plain HTTP for the keeper.

## Setup

```bash
cd scripts
npm install
cp .env.example .env   # fill in SUI_PRIVATE_KEY etc.
npm run typecheck      # verifies the code against the installed SDKs
```

`deployment.json` (git-ignored) is the shared registry of ids consumed by every
script and exported to the frontend. See `deployment.example.json` for the shape.
After `sui client publish` and `create_market`, fill in `packageId`, `marketId`,
`adminCapId`, and `underlyingType`.

## DeepBook: list, seed, trade

Spec: [`../docs/DEEPBOOK_INTEGRATION.md`](../docs/DEEPBOOK_INTEGRATION.md).

Prereqs: the seeder address holds testnet **DEEP** (pool creation fee + optional
trade fees) and some **quote** (DBUSDC). Mint PT/YT inventory from the market.

```bash
# 1) create the PT/USDC and YT/USDC permissionless pools (records ids)
npm run deepbook:pools

# 2) mint PT + YT inventory for the seeder (calls market::split_for_sender)
#    set MINT_AMOUNT_BASE in .env first
npm run deepbook:mint

# 3) create the seeder BalanceManager, deposit PT/YT/quote, post maker orders
npm run deepbook:seed

# 4) inspect both books
npm run deepbook:book
```

Each step is idempotent where it matters (pools and the balance manager are
created once and cached in `deployment.json`).

### What the frontend imports

- `src/deepbook/config.ts` → `buildSplytDeepBook(address)` returns a configured
  `DeepBookClient` plus the `coins` / `pools` maps. The frontend builds its own
  client from the same `coins`/`pools` (PT, YT registered over the network
  defaults) — note the SDK *replaces* its default maps when you pass `coins`, so
  always spread `testnetCoins` / `testnetPools` first.
- `src/deepbook/trade.ts` → `placeOrder({ pool, side, price, size })`,
  `cancelOrder(...)`, and `getOrderBook(pool)` for rendering bids/asks.
- Pool keys: `PT_USDC`, `YT_USDC`. Pool ids land in `deployment.json`.

## Files

```
src/
  env.ts            # network, SuiJsonRpcClient, signer
  deployment.ts     # read/write deployment.json
  execute.ts        # sign+execute+await, mine created-object ids
  deepbook/
    config.ts       # buildSplytDeepBook(): PT/YT coins + PT_USDC/YT_USDC pools
    createPools.ts  # npm run deepbook:pools
    mint.ts         # npm run deepbook:mint
    seed.ts         # npm run deepbook:seed
    showBook.ts     # npm run deepbook:book
    trade.ts        # frontend handoff: placeOrder / cancelOrder / getOrderBook
```

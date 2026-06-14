# Splyt off-chain scripts

TypeScript scripts for the contracts-owner track: the DeepBook listing/seed/trade
tooling and (next) the Walrus yield-curve writer. Frontend is a separate track.

- `@mysten/sui` **v2** (note: v2 moved the client to `@mysten/sui/jsonRpc` —
  `SuiJsonRpcClient` / `getJsonRpcFullnodeUrl`, not the old `SuiClient`).
- `@mysten/deepbook-v3` for `DeepBookClient`.
- Plain HTTP against the Walrus testnet publisher/aggregator for the keeper.

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

> Heads-up on testnet DEEP: permissionless pool creation costs **exactly 500 DEEP
> per pool** (asserted on-chain). DEEP is not mintable, and the `DEEP_SUI` pool
> only holds ~20 DEEP, so sourcing the 1000 DEEP for both pools on testnet needs a
> DeepBook grant. `deepbook:bm` (BalanceManager) and the read helpers need no DEEP
> and work today; on mainnet DEEP is liquid and the full flow runs end to end.

```bash
cd scripts   # all npm run commands below are from the scripts/ directory

# 0) create the seeder BalanceManager (no DEEP needed — works today)
npm run deepbook:bm

# 1) create the PT/USDC and YT/USDC permissionless pools (records ids; needs DEEP)
npm run deepbook:pools

# 2) mint PT + YT inventory for the seeder (calls market::split_for_sender)
#    set MINT_AMOUNT_BASE in .env first
npm run deepbook:mint

# 3) deposit PT/YT/quote into the BalanceManager and post maker orders
npm run deepbook:seed

# 4) inspect both books
npm run deepbook:book
```

Credit demo yield any time with `npm run accrue` (set `ACCRUE_AMOUNT_BASE`).

### Verify the trade path live (no PT/YT pools needed)

Because our pools can't be created on testnet (DEEP fee), prove the trade helpers
end-to-end against an existing pool instead — identical code, different pool:

```bash
npm run deepbook:get-deep   # swap ~1 SUI -> DEEP on the whitelisted DEEP_SUI pool
npm run deepbook:demo       # deposit -> placeOrder -> getOrderBook -> cancelOrder on DEEP_SUI
```

`deepbook:demo` places a real maker sell order via `trade.ts` `placeOrder`,
confirms it shows in `getOrderBook`, then cancels it with `cancelOrder` — the same
functions the frontend uses.

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

## Walrus: verifiable yield-curve history

Spec: [`../docs/WALRUS_INTEGRATION.md`](../docs/WALRUS_INTEGRATION.md).

The keeper reads market state (devInspect view functions) and the DeepBook mids,
computes one `{ t, impliedApy, underlyingIndex, ptMid, ytMid }` point, appends it
to a rolling series seeded from the previous Walrus blob, and stores the new
series on Walrus. The latest blob id is written to `deployment.json`.

```bash
# one snapshot (good for cron or a manual demo step)
npm run walrus:snapshot

# continuous keeper (every KEEPER_INTERVAL_SECONDS)
npm run walrus:keeper
```

**On-chain verifiability.** With `COMMIT_ON_CHAIN=true` (and `adminCapId` set),
each snapshot also calls the admin-gated `market::set_yield_history_blob`, which
stores the blob id on the Market and emits `YieldHistoryUpdated`. The frontend
reads the id from chain (view `yield_history_blob`) and fetches the content-
addressed series from the aggregator — a history nobody could fabricate
server-side. Without the flag, the keeper still works and just publishes the id
via `deployment.json`.

`impliedApy` is derived from the PT mid and time to maturity; `underlyingIndex`
is an on-chain accrual proxy (`1 + yield/principal`), ready to swap for a real
Scallop/LST index.

## Files

```
src/
  env.ts            # network, SuiJsonRpcClient, signer
  deployment.ts     # read/write deployment.json
  execute.ts        # sign+execute+await, mine created-object ids
  accrue.ts         # npm run accrue (admin-gated market::accrue)
  deepbook/
    config.ts       # buildSplytDeepBook(): PT/YT coins + PT_USDC/YT_USDC pools
    createBalanceManager.ts  # npm run deepbook:bm
    createPools.ts  # npm run deepbook:pools
    mint.ts         # npm run deepbook:mint
    seed.ts         # npm run deepbook:seed
    showBook.ts     # npm run deepbook:book
    getDeep.ts      # npm run deepbook:get-deep (swap SUI -> DEEP)
    demoTrade.ts    # npm run deepbook:demo (live trade-path proof on DEEP_SUI)
    trade.ts        # frontend handoff: placeOrder / cancelOrder / getOrderBook
  walrus/
    walrus.ts       # storeBlob / readBlob / aggregatorUrl (HTTP)
    market.ts       # readMarketState() via devInspect view functions
    compute.ts      # computeYieldPoint() (pure)
    commit.ts       # commitBlobOnChain() via market::set_yield_history_blob
    snapshot.ts     # npm run walrus:snapshot (takeSnapshot)
    keeper.ts       # npm run walrus:keeper
```

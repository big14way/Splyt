# Splyt: yield tokenization for Sui

Pendle-style PT/YT splitting on Sui. Deposit a yield-bearing underlying, get
equal Principal Tokens (PT) and Yield Tokens (YT), trade each on its own DeepBook
v3 pool, and let a verifiable yield-curve history live on Walrus.

- Track: DeFi & Payments (core)
- Sponsor surface: DeepBook (PT/YT pools), Walrus (verifiable yield history),
  OpenZeppelin (DeFi Math Library, used in `redeem_yt`)

## Architecture (locked)

Three Move modules in this package:

- `pt.move` and `yt.move` define PT and YT as standard fungible coins. They must
  be coins so DeepBook can list them as permissionless pools.
- `market.move` is the protocol: `split`, `combine`, `accrue`, `mature`,
  `redeem_pt`, `redeem_yt`, plus view functions for the indexer and frontend.

Off-chain (next files to add):

- A thin TypeScript service that creates the DeepBook pools (PT/USDC, YT/USDC),
  seeds maker orders, and exposes trade helpers via `@mysten/deepbook-v3`.
- A Walrus writer (keeper) that snapshots the yield curve each epoch and stores
  it via HTTP PUT to a publisher, committing the returned blobId on-chain or in
  an event so the history is verifiable.

## Team split

- You: this Move package, the DeepBook listing/seed script, the Walrus writer.
- Teammate (frontend): builds against the frozen interface below. Nothing here
  blocks on the off-chain pieces, so start the UI today.

## Frozen interface for the frontend

Object types and function targets the UI codes against. `PKG` is the published
package id; `MARKET` is the shared Market object id; `CLOCK` is `0x6`.

Build PTBs with `@mysten/sui` and call:

- Split:  `PKG::market::split_for_sender<U>(MARKET, coin<U>, CLOCK)`
- Combine: `PKG::market::combine<U>(MARKET, coin<PT>, coin<YT>, CLOCK)` returns `Coin<U>`
- Redeem PT: `PKG::market::redeem_pt_for_sender<U>(MARKET, coin<PT>)`
- Redeem YT: `PKG::market::redeem_yt_for_sender<U>(MARKET, coin<YT>)`

Read state for the dashboard via the view functions (devInspect or an indexer):
`maturity_ms`, `is_matured`, `principal_value`, `yield_value`, `pt_supply`,
`yt_supply`, `final_yield`, `final_yt_supply`, `yield_history_blob`. Replace
`<U>` with the fully qualified underlying coin type, for example
`0x...::usdc::USDC`. `yield_history_blob` returns the latest Walrus blob id
committed by the keeper (empty until set) — fetch the series from a Walrus
aggregator at `/v1/blobs/<blobId>`.

Trading PT and YT is a DeepBook concern, not a Splyt call: the UI uses the
DeepBook v3 SDK (`placeLimitOrder`, `placeMarketOrder`) against the PT/USDC and
YT/USDC pools created by the listing script.

## Build and deploy (testnet)

```bash
# from the package root
sui move build      # builds clean (no warnings)
sui move test       # 6 unit tests: split/combine, lifecycle, pro-rata, guards

# publish (OZ math has no published-at, so bundle it; --gas-budget ~0.5 SUI)
sui client publish --gas-budget 500000000 --with-unpublished-dependencies
```

The Move package builds and its tests pass against Sui framework `testnet` and
OpenZeppelin math `v1.1.0` (pinned in `Move.lock`). The off-chain scripts have
their own checks: `cd scripts && npm run typecheck && npm test`.

> `--with-unpublished-dependencies` is required because the OpenZeppelin math
> dependency ships no `published-at`, so Sui bundles it into our publish. We
> still genuinely depend on and call `openzeppelin_math::u64::mul_div`.

On publish, `pt::init` and `yt::init` run automatically and send both
TreasuryCaps to your address. Then create the market (pick a maturity a few
minutes out for the demo):

```bash
sui client call \
  --package PKG --module market --function create_market \
  --type-args <U> \
  --args <PT_TREASURY_CAP_ID> <YT_TREASURY_CAP_ID> <MATURITY_MS> \
  --gas-budget 50000000
```

## Live testnet deployment

Current deployment the frontend integrates against (network: **testnet**,
`<U> = 0x2::sui::SUI`, maturity ~30 days out so the market stays Active):

| What | Id |
|---|---|
| Package (`PKG`) | `0x78c280c277302119e0cd24f0622ded914103a51af4c96f6265f55a6283c3778c` |
| Market (`MARKET`) | `0x400184f76d19eb0a726af4079da37f22b0f7f5dd81f6b92a53deffdb74bfced0` |
| AdminCap | `0x5f621c34130172f80b0e139656e4f4599cb2b3c66b2fe6fbd6b97ba3d630eccb` |
| Seeder BalanceManager | `0x7497d0b34f4804d2abae94618e196ae01d0062d71b17da0ab1b925ebe7f32373` |
| PT type | `PKG::pt::PT` · YT type `PKG::yt::YT` (both 9 decimals) |
| Yield history (Walrus) | read the `yield_history_blob` view on the Market, then fetch `AGGREGATOR/v1/blobs/<id>` |

Live and verified on-chain: `split`/`combine`/`accrue`, the `market::*` views, and
the Walrus yield history (blob id committed on-chain via `set_yield_history_blob`,
content fetchable from the aggregator). The keeper is running snapshots.

**DeepBook trade integration is verified live; our own PT/YT pools aren't created
yet.** The full trade path — deposit → `placeOrder` → `getOrderBook` → `cancelOrder`,
the exact helpers the frontend imports — is proven end-to-end against a live pool
(`npm run deepbook:demo`: places and cancels a real maker order on DEEP_SUI). What
is blocked is *creating* the PT/USDC + YT/USDC pools: permissionless creation costs
a fixed **500 DEEP per pool** (asserted exactly, on-chain), and testnet DEEP is
scarce — not mintable, and the DEEP pools hold only ~20 each, so the 1000 DEEP for
both pools can't be sourced on testnet. Once DEEP is available (a DeepBook testnet
grant, or on mainnet), create and seed them — the npm scripts live in `scripts/`,
so run them from there and prefix each with `npm run`:

```bash
cd scripts
npm run deepbook:bm      # BalanceManager (needs no DEEP — works today)
npm run deepbook:pools   # PT/USDC + YT/USDC pools (needs DEEP)
npm run deepbook:mint    # mint PT/YT inventory
npm run deepbook:seed    # deposit + maker orders
```

## The web app

A Next.js 14 app in [`web/`](web/) drives the whole product: connect wallet,
Split, Combine, Trade (place/cancel/withdraw on DeepBook), Redeem, and the
Walrus yield-curve chart. It reads live ids from [`web/lib/config.ts`](web/lib/config.ts).

```bash
cd web && npm install && npm run dev   # http://localhost:3000
```

## Demo flow

The live market matures ~30 days out, so split/combine/trade/chart can be
demoed any time on it. To show the **redeem lifecycle** on camera without
waiting, deploy a fresh short-maturity market first:

```bash
# deployer wallet needs ~1.5 testnet SUI (faucet.sui.io)
./scripts/new-demo-market.sh 12     # market matures in 12 min; rewrites web/lib/config.ts
cd web && npm run dev                # restart the app on the new market
# …record, then: git checkout web/lib/config.ts   # restore the stable market
```

Then walk the app:

1. **Split** a SUI deposit → equal PT + YT minted (TVL rises).
2. **Trade** PT/YT — runs on the live DEEP/SUI pool today; PT/USDC + YT/USDC
   show "Awaiting pool" until testnet DEEP is available. Place, then cancel, an order.
3. **Combine** equal PT + YT back into SUI before maturity.
4. The keeper `accrue`s yield and snapshots the Walrus curve each step — show the
   rising **yield index** and the verifiable "Stored on Walrus" badge.
5. After maturity, **Settle**, then **Redeem PT** for principal and **Redeem YT**
   for the pro-rata yield.

## Notes and known simplifications

- Settlement is European-style (claim at maturity, not continuous). Continuous
  YT accrual with a per-account interest index is the natural follow-up.
- The yield source sits behind `accrue` and the AdminCap. The demo uses a
  controlled keeper; production wires a Scallop receipt or a Sui LST rate with no
  change to the PT/YT logic.
- One market per PT/YT currency set, enforced because `create` consumes both
  TreasuryCaps. Multi-market needs generic or per-market coin types.
- `redeem_yt` uses `openzeppelin_math::u64::mul_div` with round-down so the sum
  of payouts never exceeds the pool.

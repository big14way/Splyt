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
sui move build

# publish
sui client publish --gas-budget 200000000
```

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

## Demo flow

1. `split_for_sender` a deposit of `U`, show equal PT and YT minted.
2. List PT/USDC and YT/USDC on DeepBook, seed a few maker orders, trade one of
   each. PT sits below par (implied fixed yield), YT prices the yield.
3. `accrue` yield via the AdminCap keeper a few times. The Walrus writer
   snapshots the implied APY each step.
4. After maturity, `mature`, then `redeem_pt` for principal and `redeem_yt` for
   the pro-rata yield share. Show the Walrus-backed yield history chart.

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

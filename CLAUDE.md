# CLAUDE.md: build guide for Splyt

This file orients an AI coding agent (or a new contributor) working on this repo.
Read this first, then `README.md`, then the files in `docs/`.

## What Splyt is

Pendle-style yield tokenization on Sui for the Sui Overflow 2026 hackathon.
Deposit a yield-bearing underlying coin, split it into Principal Tokens (PT) and
Yield Tokens (YT), trade each on its own DeepBook v3 pool, and store a verifiable
yield-curve history on Walrus.

- Submission track: DeFi & Payments (core)
- Sponsor surface: DeepBook (PT/YT pools), Walrus (verifiable yield history),
  OpenZeppelin (DeFi Math Library, used in `market::redeem_yt`)

## Repo status

Done (in this zip):
- `sources/pt.move`, `sources/yt.move`: PT and YT fungible coins.
- `sources/market.move`: the protocol (split, combine, accrue, mature,
  redeem_pt, redeem_yt, view functions).
- `Move.toml`: wired to OpenZeppelin math by git.

To do (your job, in priority order):
1. `sui move build` and fix any toolchain-specific nits. The contracts were
   written against verified APIs but were not compiled in the authoring
   environment, so the first build is the gate.
2. Publish to testnet, create one market, record the ids (see README).
3. Build the DeepBook listing + seed + trade script. Spec: `docs/DEEPBOOK_INTEGRATION.md`.
4. Build the Walrus yield-curve writer (keeper). Spec: `docs/WALRUS_INTEGRATION.md`.
5. Frontend. Full spec: `docs/FRONTEND.md`. This is the teammate's track and is
   self-contained; it can start immediately against the frozen interface.

## Conventions

- Move 2024 edition, label-module style (`module splyt::market;`).
- `object`, `transfer`, `tx_context` are implicitly aliased in 2024 edition. Do
  not add `use` lines for them. Use `ctx.sender()`, `transfer::share_object`,
  `object::new(ctx)` directly.
- Keep PT and YT as fungible coins. This is load-bearing: DeepBook lists
  `Coin<Base>/Coin<Quote>` pools, so PT and YT must be coins to be tradeable.
- Off-chain code is TypeScript. Frontend uses `@mysten/dapp-kit` + `@mysten/sui`.
  Scripts use `@mysten/sui` + `@mysten/deepbook-v3`.

## Verified external APIs (do not hallucinate these)

These were checked against live sources while authoring. Trust them over training
priors, and re-check version pins before shipping.

OpenZeppelin Contracts for Sui, math/core (package `openzeppelin_math`):
- Testnet package id: `0x6ad7f3ef1086b951bd51ef9439cf67e89561c0c631c2ce7495a217612f9c6fc1`
- `openzeppelin_math::u64::mul_div(a: u64, b: u64, denominator: u64, rounding_mode): Option<u64>`
  Aborts on zero denominator. Returns none on overflow of the result.
- `openzeppelin_math::rounding::down()` / `up()` / `nearest()` return a RoundingMode.
- Move.toml dep: `{ git = "https://github.com/OpenZeppelin/contracts-sui.git", subdir = "math/core", rev = "v1.1.0" }`
- There is also `openzeppelin_access::access_control` (role-based, OTW root role)
  if you want more OZ surface than the math library.

DeepBook v3:
- TS SDK package: `@mysten/deepbook-v3`, class `DeepBookClient`.
- Permissionless pool creation: `createPermissionlessPool` (costs DEEP).
- Orders: `placeLimitOrder`, `placeMarketOrder`, `cancelOrder`. Account model is
  `BalanceManager` (a shared object holding balances; create one per user).
- `pay_with_deep` flag selects whether fees are paid in DEEP or the input token.
- Move package source: github.com/MystenLabs/deepbookv3.

Walrus:
- Store: HTTP `PUT $PUBLISHER/v1/blobs` (optionally `?epochs=N`, `?send_object_to=ADDR`).
  Returns JSON with the blobId.
- Read: HTTP `GET $AGGREGATOR/v1/blobs/<blobId>`.
- Testnet publisher/aggregator: `https://publisher.walrus-testnet.walrus.space`,
  `https://aggregator.walrus-testnet.walrus.space`.
- Mainnet has no public unauthenticated publisher: run your own or use the
  TypeScript SDK / Upload Relay.
- TS SDK: `@mysten/walrus`.

Sui frontend stack (current):
- `@mysten/dapp-kit` (React hooks/components), `@mysten/sui` (core SDK),
  `@tanstack/react-query` (peer).
- `Transaction` from `@mysten/sui/transactions` (NOT `TransactionBlock` from the
  deprecated `@mysten/sui.js`).
- Hooks: `useSignAndExecuteTransaction`, `useCurrentAccount`, `useSuiClient`,
  `useSuiClientQuery`. Components: `ConnectButton`, `SuiClientProvider`,
  `WalletProvider`.

## Move call targets (the frozen interface)

`PKG` = published package id, `MARKET` = shared Market object id, `CLOCK` = `0x6`,
`<U>` = fully qualified underlying coin type.

- `PKG::market::split_for_sender<U>(MARKET, Coin<U>, CLOCK)`
- `PKG::market::combine<U>(MARKET, Coin<PT>, Coin<YT>, CLOCK) -> Coin<U>`
- `PKG::market::redeem_pt_for_sender<U>(MARKET, Coin<PT>)`
- `PKG::market::redeem_yt_for_sender<U>(MARKET, Coin<YT>)`
- Views: `maturity_ms`, `is_matured`, `principal_value`, `yield_value`,
  `pt_supply`, `yt_supply`, `final_yield`, `final_yt_supply`.

PT and YT trading is not a Splyt call. It goes through the DeepBook SDK against
the PT/USDC and YT/USDC pools created by the listing script.

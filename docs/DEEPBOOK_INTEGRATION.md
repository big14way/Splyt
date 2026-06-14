# DeepBook v3 integration

Goal: list PT and YT as tradeable pools, seed a little liquidity, and expose
trade helpers the frontend uses. This is the contracts owner's task. Package:
`@mysten/deepbook-v3` (class `DeepBookClient`). Move package: github.com/MystenLabs/deepbookv3.

## Concepts

- A `Pool` is one trading pair, for example PT/USDC. Pools are permissionless:
  anyone can create one with `createPermissionlessPool` (costs DEEP).
- A `BalanceManager` is a shared account object holding a user's balances for
  trading. Each user (and your seeder) needs one. It can hold many balances and
  authorize traders.
- Orders: `placeLimitOrder`, `placeMarketOrder`, `cancelOrder`. The
  `pay_with_deep` flag chooses DEEP vs input-token fees.

## Steps

1. Acquire testnet DEEP and USDC (faucets / testnet sources). DEEP is needed for
   pool creation and, if `pay_with_deep` is true, for fees.
2. Create two permissionless pools: PT/USDC and YT/USDC. Record the returned pool
   ids and pick stable pool keys (`PT_USDC`, `YT_USDC`) for the SDK config.
3. Create a seeder `BalanceManager`, deposit some PT, YT, and USDC into it (mint
   PT/YT by calling `split` on the Splyt market first).
4. Seed maker orders: a couple of bids and asks on each pool so the book is not
   empty for the demo. PT asks should sit below par to show an implied fixed
   yield; YT around its expected value.
5. Export the pool keys, the DeepBook package config, and a `placeOrder` helper
   for the frontend.

## Reference shape

```ts
import { DeepBookClient } from '@mysten/deepbook-v3';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const sui = new SuiClient({ url: getFullnodeUrl('testnet') });
const dbClient = new DeepBookClient({
  client: sui,
  address: SEEDER_ADDRESS,
  env: 'testnet',
  // register your custom coins (PT, YT, USDC) and balance managers in the
  // client config per the SDK docs so pool/coin keys resolve
});

// 1) create a pool (returns a function that takes a Transaction)
const tx = new Transaction();
dbClient.deepBook.createPermissionlessPool({
  baseCoinKey: 'PT',
  quoteCoinKey: 'USDC',
  tickSize: 0.001,
  lotSize: 0.001,
  minSize: 0.01,
})(tx);
// sign and execute tx, capture the new pool id

// 2) place a maker limit order
const tx2 = new Transaction();
dbClient.deepBook.placeLimitOrder({
  poolKey: 'PT_USDC',
  balanceManagerKey: 'SEEDER',
  clientOrderId: '1',
  price: 0.97,        // PT below par => implied fixed yield
  quantity: 100,
  isBid: false,       // ask
  payWithDeep: true,
})(tx2);
```

Confirm the exact parameter names and pool-config fields against the live SDK
docs (docs.sui.io/standards/deepbookv3-sdk) before shipping; the SDK evolves.

## What to hand the frontend

- The two pool keys and their pool ids.
- The DeepBook client config (coins, pools) as a shared module.
- A `placeOrder({ pool, side, price, size })` helper and a `cancelOrder` helper.
- A `getOrderBook(pool)` read for rendering bids/asks.

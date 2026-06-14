# Splyt frontend build spec

Self-contained guide to build the Splyt web app. Follow it top to bottom and the
UI will match how a modern Sui DeFi app should look and behave. You can start now
against the frozen interface; you do not need the contracts deployed to build the
UI shell, only to wire live data at the end.

## 0. What you are building

A yield-tokenization dApp with four core actions:

1. Split: deposit underlying, mint equal PT and YT.
2. Trade: buy or sell PT and YT on DeepBook (PT below par = fixed yield, YT = yield bet).
3. Combine: merge equal PT and YT back to underlying before maturity.
4. Redeem: after maturity, PT for principal, YT for pro-rata yield.

Plus a market dashboard with a yield-curve chart sourced from Walrus.

## 1. Stack (current, verified)

- React 18 + TypeScript.
- Next.js 14 App Router (or Vite + React, your call; this spec assumes Next.js).
- `@mysten/dapp-kit` for wallet connect and RPC hooks.
- `@mysten/sui` for building transactions. Import `Transaction` from
  `@mysten/sui/transactions`. Do NOT use the deprecated `@mysten/sui.js` or
  `TransactionBlock`.
- `@mysten/deepbook-v3` for the `DeepBookClient` (trading PT/YT).
- `@tanstack/react-query` (peer of dapp-kit).
- Tailwind CSS + shadcn/ui for components. Recharts for the yield chart.

Install:

```bash
npm install @mysten/dapp-kit @mysten/sui @mysten/deepbook-v3 @tanstack/react-query
npm install recharts
# tailwind + shadcn/ui per their standard setup
```

## 2. Providers and network config

Wrap the app once. `app/providers.tsx`:

```tsx
'use client';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFullnodeUrl } from '@mysten/sui/client';
import '@mysten/dapp-kit/dist/index.css';

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

Header connect button is just `<ConnectButton />` from `@mysten/dapp-kit`.

## 3. Config constants

`lib/config.ts`. Fill these from the deploy output (see repo README):

```ts
export const PKG = '0x...';          // published Splyt package id
export const MARKET = '0x...';       // shared Market object id
export const CLOCK = '0x6';          // Sui system Clock
export const UNDERLYING_TYPE = '0x...::usdc::USDC'; // your <U>
export const PT_TYPE = `${PKG}::pt::PT`;
export const YT_TYPE = `${PKG}::yt::YT`;

// DeepBook pool keys created by the listing script
export const PT_POOL = 'PT_USDC';
export const YT_POOL = 'YT_USDC';

// Walrus
export const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
export const YIELD_HISTORY_BLOB = '0x...'; // set by the keeper, or fetched from chain
```

## 4. Building transactions (the four actions)

Use one helper module, `lib/tx.ts`. Each function returns a `Transaction` that
you pass to `useSignAndExecuteTransaction`.

```ts
import { Transaction } from '@mysten/sui/transactions';
import { PKG, MARKET, CLOCK, UNDERLYING_TYPE, PT_TYPE, YT_TYPE } from './config';

// amount is in base units (respect the coin's decimals)
export function buildSplit(coinObjectId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::market::split_for_sender`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), tx.object(coinObjectId), tx.object(CLOCK)],
  });
  return tx;
}

export function buildCombine(ptId: string, ytId: string) {
  const tx = new Transaction();
  // combine returns Coin<U>; transfer it to the sender
  const out = tx.moveCall({
    target: `${PKG}::market::combine`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), tx.object(ptId), tx.object(ytId), tx.object(CLOCK)],
  });
  tx.transferObjects([out], tx.pure.address('SENDER_ADDRESS'));
  return tx;
}

export function buildRedeemPt(ptId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::market::redeem_pt_for_sender`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), tx.object(ptId)],
  });
  return tx;
}

export function buildRedeemYt(ytId: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::market::redeem_yt_for_sender`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), tx.object(ytId)],
  });
  return tx;
}
```

Execute (pattern for every button):

```tsx
const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
const account = useCurrentAccount();

function onSplit(coinId: string) {
  signAndExecute(
    { transaction: buildSplit(coinId) },
    {
      onSuccess: (res) => { /* toast success, refetch balances */ },
      onError: (e) => { /* toast error e.message */ },
    },
  );
}
```

Coin selection: split needs a single `Coin<U>` object of the exact deposit
amount. Use `tx.splitCoins` on a larger coin first, or merge/split client-side.
For the demo, let the user pick an existing coin or split gas-style from a known
coin object. Fetch the user's coins with `client.getCoins({ owner, coinType })`.

## 5. Reading market state

The view functions return values via devInspect. Helper:

```ts
import { Transaction } from '@mysten/sui/transactions';

export async function readMarket(client, fn: string) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::market::${fn}`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET)],
  });
  const res = await client.devInspectTransactionBlock({
    sender: '0x0',
    transactionBlock: tx,
  });
  // parse res.results[0].returnValues[0] (BCS-encoded u64/bool)
  return res;
}
```

Read `maturity_ms`, `is_matured`, `principal_value`, `yield_value`, `pt_supply`,
`yt_supply` to drive the dashboard. The implied fixed APY shown on the PT card is
derived from the live PT/USDC mid price on DeepBook and time to maturity, not
from the contract.

For user balances of PT and YT, use `useSuiClientQuery('getBalance', { owner,
coinType: PT_TYPE })` and the same for YT.

## 6. Trading on DeepBook

PT and YT trades go through `@mysten/deepbook-v3`, not Splyt. Create a
`DeepBookClient`, ensure the user has a `BalanceManager`, then call
`placeLimitOrder` / `placeMarketOrder` against `PT_POOL` and `YT_POOL`. The exact
pool keys, BalanceManager setup, and a ready trade helper come from the listing
script the contracts owner is writing (`docs/DEEPBOOK_INTEGRATION.md`). Treat the
trade panel as: pick side (buy/sell), pick PT or YT, enter price and size, submit.
Show the live order book (bids/asks) from the pool and the user's open orders.

## 7. Yield-curve chart from Walrus

The keeper writes a JSON time series to Walrus. Read it from the aggregator:

```ts
export async function fetchYieldHistory(blobId: string) {
  const r = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
  if (!r.ok) throw new Error('walrus read failed');
  return r.json(); // [{ t, impliedApy, underlyingIndex }, ...]
}
```

Render with Recharts as an area/line chart of implied APY over time. Add a small
"verifiable, stored on Walrus" badge that links to the aggregator URL of the
blob. This is the visible payoff of the Walrus integration, so make it prominent.

## 8. Design system

Target the look of current Sui DeFi apps (Suilend, Scallop, DeepBook UI,
Aftermath): dark, calm, data-dense, oceanic. Precise and trustworthy, not loud.

Palette (CSS variables):

```css
:root {
  --bg:        #0A0F1E;   /* deep navy, near-black */
  --surface:   #111A2E;   /* card background */
  --surface-2: #16213C;   /* raised / hover */
  --border:    #1E2C49;
  --text:      #E8EEF9;
  --text-dim:  #8A9ABF;
  --sui:       #4DA2FF;   /* Sui sea blue, primary accent */
  --sui-deep:  #2E7DE0;
  --teal:      #38D6C8;   /* secondary accent, use sparingly */
  --pt:        #4DA2FF;   /* PT brand color */
  --yt:        #38D6C8;   /* YT brand color */
  --pos:       #2EE6A8;   /* gains */
  --neg:       #FF6B6B;   /* losses */
  --warn:      #FFB454;
}
```

Typography:
- UI text: Inter or Geist, weights 400/500/600.
- All numbers (prices, sizes, APYs, balances): a monospaced or tabular-figures
  font (Geist Mono, JetBrains Mono, or `font-variant-numeric: tabular-nums`).
  DeFi numbers must align in columns and not jitter while updating.

Surfaces and depth:
- Cards: `--surface`, 1px `--border`, radius 16px, soft shadow. Optional subtle
  glass effect: `backdrop-blur` over a faint gradient. Keep it restrained.
- Primary buttons: `--sui` fill, dark text, radius 12px, hover to `--sui-deep`.
- Secondary buttons: transparent, `--border` outline, `--text` label.
- Inputs: `--surface-2` fill, focus ring in `--sui`.

Color logic:
- PT is always `--pt` blue, YT always `--yt` teal, everywhere (chips, chart
  series, balances). Consistent token color is the fastest way for users to read
  the split.
- Gains green, losses red, never the reverse.

Motion:
- 150 to 200ms ease on hovers and value changes. Animate number changes with a
  brief highlight, not a spinner. No bouncy or playful easing; this is finance.

## 9. Pages and components

Layout: left rail or top nav, max content width about 1200px, generous spacing.

- App shell: logo, nav (Markets, Trade, Portfolio), `<ConnectButton />`, network
  badge (Testnet).
- Markets / Market detail (home):
  - Header: market name, underlying, maturity countdown, status (Active / Matured).
  - Three stat cards: TVL (principal_value), accrued yield (yield_value), implied
    fixed APY (from PT price).
  - Split panel: amount input, "You receive X PT + X YT", Split button.
  - Yield-curve chart (Walrus), with the verifiable badge.
- Trade:
  - Token toggle (PT / YT), order book, price + size form, buy/sell, open orders,
    recent fills. Powered by DeepBook.
- Portfolio:
  - User PT and YT balances, position value, Combine panel (pre-maturity),
    Redeem panels (post-maturity, enabled only when is_matured).
- Global: toast notifications for tx states, a tx-pending overlay tied to
  `isPending`, an explorer link on success (suiscan/suivision).

Empty and error states everywhere: no wallet, wrong network, no positions, market
matured, Walrus read failed. Each gets a calm one-line message and a clear action.

## 10. UX rules

- Gate actions on wallet connect and correct network. If on the wrong network,
  show a switch prompt, do not let the user submit.
- Pre-fill and validate amounts against the user's actual balance. Disable the
  submit button with a reason ("Enter an amount", "Insufficient USDC").
- Combine requires equal PT and YT; auto-balance the inputs and show the max.
- Redeem panels appear only after maturity (`is_matured === true`). Before that,
  show the maturity countdown instead.
- Always show what the user will receive before they sign.
- After any successful tx, refetch balances and market state.

## 11. Accessibility and responsive

- Full keyboard nav, visible focus rings, aria labels on icon buttons.
- Contrast: body text at least 4.5:1 on `--bg`. `--text-dim` only for secondary.
- Responsive down to 375px: stack panels, make the order book scrollable, keep
  number columns aligned.

## 12. Acceptance checklist

- [ ] Wallet connects, network badge correct, autoConnect works.
- [ ] Split executes and the user sees new PT and YT balances.
- [ ] Combine executes pre-maturity and returns underlying.
- [ ] Trade panel places and cancels orders on both PT and YT pools.
- [ ] Yield-curve chart renders from Walrus with a working verifiable link.
- [ ] Redeem PT and YT work after maturity and are hidden before.
- [ ] All states (loading, empty, error, wrong network) are handled.
- [ ] PT blue / YT teal used consistently; numbers use tabular figures.
- [ ] Looks at home next to Suilend or Scallop: dark, clean, data-dense.
```

# Walrus integration

Goal: a keeper that snapshots the market's yield curve on a schedule and stores
each snapshot (or a rolling series) on Walrus, so the frontend can render a
verifiable yield history. This is the visible Walrus payoff for judges.

## What to store

A JSON time series, one point per snapshot:

```json
[
  { "t": 1718000000, "impliedApy": 0.062, "underlyingIndex": 1.0041, "ptMid": 0.971, "ytMid": 0.041 },
  { "t": 1718003600, "impliedApy": 0.058, "underlyingIndex": 1.0048, "ptMid": 0.973, "ytMid": 0.039 }
]
```

- `impliedApy`: derived from PT mid price and time to maturity.
- `underlyingIndex`: the yield index of the underlying (or your accrual proxy).
- `ptMid` / `ytMid`: DeepBook mid prices.

## Write path (testnet, HTTP)

```ts
const PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';

async function storeYieldHistory(series: unknown) {
  const body = JSON.stringify(series);
  // epochs controls how long Walrus keeps the blob
  const r = await fetch(`${PUBLISHER}/v1/blobs?epochs=5`, {
    method: 'PUT',
    body,
  });
  if (!r.ok) throw new Error('walrus store failed');
  const json = await r.json();
  // blobId is under newlyCreated.blobObject.blobId or alreadyCertified.blobId
  const blobId =
    json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId;
  return blobId as string;
}
```

Read back via the aggregator: `GET https://aggregator.walrus-testnet.walrus.space/v1/blobs/<blobId>`.

Mainnet has no public unauthenticated publisher: run your own authenticated
publisher or use the `@mysten/walrus` TS SDK / Upload Relay. Testnet is fine for
the hackathon demo.

## Keeper loop

1. Read market state from chain (`yield_value`, supplies, maturity).
2. Read PT and YT mids from DeepBook.
3. Compute the new data point, append to the in-memory series.
4. `storeYieldHistory(series)` to Walrus, get the new blobId.
5. Publish the blobId so the frontend can find it: simplest is to write it to a
   small config or emit it; stronger is to commit it on-chain (store the latest
   blobId in the Market via an admin-gated setter, or emit an event). Committing
   on-chain is what makes the history verifiable and is worth doing for judging.

## Make it verifiable (the point)

In the UI, show a "Stored on Walrus" badge that links to the aggregator URL of
the current blob. If you commit the blobId on-chain, also show the Sui object or
event that holds it. The story for judges: the yield history is not a number your
server made up, it is content-addressed data anyone can fetch and verify.

## Optional: encrypted variant

If you want more Walrus surface, encrypt premium history with Seal and gate read
access. Not required for the core demo; skip unless time allows.

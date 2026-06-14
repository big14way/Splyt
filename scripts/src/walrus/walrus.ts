/**
 * Walrus store/read over the testnet HTTP publisher + aggregator.
 *
 * Store: PUT $PUBLISHER/v1/blobs?epochs=N  ->  { newlyCreated | alreadyCertified }
 * Read:  GET $AGGREGATOR/v1/blobs/<blobId>
 *
 * Mainnet has no public unauthenticated publisher (run your own or use the
 * @mysten/walrus SDK / Upload Relay); testnet HTTP is the hackathon path.
 */
const PUBLISHER = process.env.WALRUS_PUBLISHER ?? 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR = process.env.WALRUS_AGGREGATOR ?? 'https://aggregator.walrus-testnet.walrus.space';
const DEFAULT_EPOCHS = Number(process.env.WALRUS_EPOCHS ?? 5);

export interface YieldPoint {
  /** Unix seconds. */
  t: number;
  /** Implied fixed APY from the PT mid and time to maturity. */
  impliedApy: number;
  /** Accrual proxy index derived from on-chain yield/principal. */
  underlyingIndex: number;
  /** DeepBook mid prices (null until a two-sided book exists). */
  ptMid: number | null;
  ytMid: number | null;
}

interface WalrusStoreResponse {
  newlyCreated?: { blobObject?: { blobId?: string } };
  alreadyCertified?: { blobId?: string };
}

/** Store `data` as JSON on Walrus and return its blob id. */
export async function storeBlob(data: unknown, epochs = DEFAULT_EPOCHS): Promise<string> {
  const r = await fetch(`${PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    throw new Error(`Walrus store failed: ${r.status} ${await r.text().catch(() => '')}`);
  }
  const json = (await r.json()) as WalrusStoreResponse;
  const blobId = json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId;
  if (!blobId) throw new Error(`Walrus response missing blobId: ${JSON.stringify(json)}`);
  return blobId;
}

/** Read a JSON blob back from the aggregator. */
export async function readBlob<T = unknown>(blobId: string): Promise<T> {
  const r = await fetch(aggregatorUrl(blobId));
  if (!r.ok) throw new Error(`Walrus read failed: ${r.status}`);
  return (await r.json()) as T;
}

/** Public, content-addressed URL for a blob — used for the "stored on Walrus" badge. */
export function aggregatorUrl(blobId: string): string {
  return `${AGGREGATOR}/v1/blobs/${blobId}`;
}

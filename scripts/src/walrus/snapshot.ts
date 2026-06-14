/**
 * Take ONE yield-curve snapshot: read market state + DeepBook mids, compute the
 * point, append to the rolling series (seeded from the last Walrus blob), store
 * the new series on Walrus, and stamp the blob id into deployment.json.
 *
 * Optionally commits the blob id on-chain (COMMIT_ON_CHAIN=true), which needs
 * the AdminCap. Run standalone or import `takeSnapshot` from the keeper loop.
 *
 *   npm run walrus:snapshot
 */
import { fileURLToPath } from 'node:url';
import { READ_ONLY_ADDRESS } from '../env';
import { loadDeployment, updateDeployment } from '../deployment';
import { buildSplytDeepBook, PT_POOL_KEY, YT_POOL_KEY } from '../deepbook/config';
import type { DeepBookClient } from '@mysten/deepbook-v3';
import { readMarketState } from './market';
import { computeYieldPoint } from './compute';
import { aggregatorUrl, readBlob, storeBlob, type YieldPoint } from './walrus';
import { commitBlobOnChain } from './commit';

const MAX_POINTS = Number(process.env.KEEPER_MAX_POINTS ?? 500);
const COMMIT_ON_CHAIN = (process.env.COMMIT_ON_CHAIN ?? 'false') === 'true';

async function loadSeries(): Promise<YieldPoint[]> {
  const { yieldHistoryBlobId } = loadDeployment();
  if (!yieldHistoryBlobId) return [];
  try {
    const prev = await readBlob<YieldPoint[]>(yieldHistoryBlobId);
    return Array.isArray(prev) ? prev : [];
  } catch {
    // Blob expired or unreachable — start a fresh series rather than failing.
    return [];
  }
}

async function midOrNull(db: DeepBookClient, pool: string): Promise<number | null> {
  try {
    return await db.midPrice(pool);
  } catch {
    return null;
  }
}

export interface SnapshotResult {
  point: YieldPoint;
  blobId: string;
  url: string;
  size: number;
}

export async function takeSnapshot(): Promise<SnapshotResult> {
  // Read-only: market views, DeepBook mids, and Walrus PUT need no signer. Only
  // the optional on-chain commit (below) loads the keypair.
  const { db } = buildSplytDeepBook(READ_ONLY_ADDRESS);

  const [state, ptMid, ytMid] = await Promise.all([
    readMarketState(),
    midOrNull(db, PT_POOL_KEY),
    midOrNull(db, YT_POOL_KEY),
  ]);

  const point = computeYieldPoint({ nowMs: Date.now(), state, ptMid, ytMid });

  const series = await loadSeries();
  series.push(point);
  while (series.length > MAX_POINTS) series.shift();

  const blobId = await storeBlob(series);
  updateDeployment({ yieldHistoryBlobId: blobId });

  if (COMMIT_ON_CHAIN) {
    await commitBlobOnChain(blobId);
  }

  const url = aggregatorUrl(blobId);
  console.log(
    `✓ snapshot t=${point.t} apy=${point.impliedApy} ptMid=${point.ptMid} ytMid=${point.ytMid} ` +
      `index=${point.underlyingIndex}`,
  );
  console.log(`  series=${series.length} blob=${blobId}`);
  console.log(`  ${url}`);
  return { point, blobId, url, size: series.length };
}

// Run once when invoked directly (but not when imported by the keeper).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  takeSnapshot().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

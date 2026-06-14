/**
 * Walrus keeper: take a yield-curve snapshot every KEEPER_INTERVAL_SECONDS and
 * store the rolling series on Walrus. Survives transient failures (a bad RPC or
 * publisher response logs and is retried on the next tick).
 *
 *   npm run walrus:keeper
 */
import { takeSnapshot } from './snapshot';

const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_SECONDS ?? 300) * 1000;

async function tick(): Promise<void> {
  try {
    await takeSnapshot();
  } catch (e) {
    console.error('snapshot failed:', e instanceof Error ? e.message : e);
  }
}

async function main(): Promise<void> {
  console.log(`Walrus keeper started — every ${INTERVAL_MS / 1000}s. Ctrl-C to stop.`);
  await tick();
  setInterval(() => {
    void tick();
  }, INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

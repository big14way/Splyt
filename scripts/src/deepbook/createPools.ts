/**
 * Step 1 of the DeepBook listing: create the two permissionless pools,
 * PT/USDC and YT/USDC, and record their ids in deployment.json.
 *
 * Pool creation costs DEEP (`POOL_CREATION_FEE_DEEP`), pulled automatically from
 * the seeder's DEEP balance, so the signer must hold some testnet DEEP.
 *
 * Idempotent: a pool already recorded in deployment.json is skipped.
 *
 *   npm run deepbook:pools
 */
import { Transaction } from '@mysten/sui/transactions';
import { loadAddress } from '../env';
import { signAndExecute, findCreatedObjectId } from '../execute';
import { loadDeployment, setPoolId } from '../deployment';
import { buildSplytDeepBook, PT_POOL_KEY, YT_POOL_KEY } from './config';

// Conservative defaults. Tick/lot in quote/base units, min order size in base.
const TICK_SIZE = 0.001;
const LOT_SIZE = 0.001;
const MIN_SIZE = 0.01;

async function ensurePool(baseCoinKey: 'PT' | 'YT', poolKey: string) {
  const existing = loadDeployment().pools?.[poolKey];
  if (existing) {
    console.log(`✓ ${poolKey} already created: ${existing}`);
    return existing;
  }

  const address = loadAddress();
  const { db, coins, quoteCoinKey } = buildSplytDeepBook(address);
  const baseType = coins[baseCoinKey].type;

  console.log(`Creating ${poolKey} (${baseCoinKey}/${quoteCoinKey}) ...`);
  const tx = new Transaction();
  db.deepBook.createPermissionlessPool({
    baseCoinKey,
    quoteCoinKey,
    tickSize: TICK_SIZE,
    lotSize: LOT_SIZE,
    minSize: MIN_SIZE,
  })(tx);

  const res = await signAndExecute(tx);
  // The new pool is a shared object of type `<deepbook>::pool::Pool<Base, Quote>`.
  const poolId = findCreatedObjectId(res.objectChanges, '::pool::Pool<', baseType);
  if (!poolId) {
    throw new Error(
      `Could not find the created pool object for ${poolKey} in tx ${res.digest}. ` +
        'Inspect the transaction on an explorer and set deployment.json pools manually.',
    );
  }

  setPoolId(poolKey, poolId);
  console.log(`✓ ${poolKey} created: ${poolId} (tx ${res.digest})`);
  return poolId;
}

async function main() {
  await ensurePool('PT', PT_POOL_KEY);
  await ensurePool('YT', YT_POOL_KEY);
  console.log('\nPools recorded in deployment.json. Next: npm run deepbook:seed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

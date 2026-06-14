/**
 * Create (and share) the seeder BalanceManager and record its id. Split out from
 * seeding because it needs no DEEP/liquidity — only gas — so it can run before
 * the pools exist. Idempotent: skips if deployment.json already has one.
 *
 *   npm run deepbook:bm
 */
import { Transaction } from '@mysten/sui/transactions';
import { loadAddress } from '../env';
import { signAndExecute, findCreatedObjectId } from '../execute';
import { loadDeployment, updateDeployment } from '../deployment';
import { buildSplytDeepBook } from './config';

async function main() {
  const existing = loadDeployment().balanceManagerId;
  if (existing) {
    console.log(`✓ BalanceManager already exists: ${existing}`);
    return;
  }
  const { db } = buildSplytDeepBook(loadAddress());
  const tx = new Transaction();
  db.balanceManager.createAndShareBalanceManager()(tx);
  const res = await signAndExecute(tx);
  const id = findCreatedObjectId(res.objectChanges, '::balance_manager::BalanceManager');
  if (!id) throw new Error(`Could not find created BalanceManager in tx ${res.digest}.`);
  updateDeployment({ balanceManagerId: id });
  console.log(`✓ BalanceManager created: ${id} (tx ${res.digest})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

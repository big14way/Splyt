/**
 * Commit the latest Walrus blob id on-chain via the admin-gated
 * `market::set_yield_history_blob`. This is the verifiability anchor: the id is
 * stored on the Market and emitted as a `YieldHistoryUpdated` event, so the
 * frontend can fetch a history nobody could have fabricated server-side.
 *
 * Requires the AdminCap (deployment.adminCapId) held by the keeper signer.
 */
import { Transaction } from '@mysten/sui/transactions';
import { signAndExecute } from '../execute';
import { loadDeployment, requirePackage } from '../deployment';

export async function commitBlobOnChain(blobId: string): Promise<string> {
  const d = loadDeployment();
  const pkg = requirePackage(d);
  if (!d.marketId) throw new Error('deployment.marketId is not set.');
  if (!d.adminCapId) throw new Error('deployment.adminCapId is not set — needed to commit on-chain.');
  if (!d.underlyingType) throw new Error('deployment.underlyingType is not set.');

  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::market::set_yield_history_blob`,
    typeArguments: [d.underlyingType],
    arguments: [tx.object(d.marketId), tx.object(d.adminCapId), tx.pure.string(blobId)],
  });

  const res = await signAndExecute(tx);
  console.log(`✓ committed yield-history blob id on-chain (tx ${res.digest})`);
  return res.digest;
}

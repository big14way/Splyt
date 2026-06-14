/**
 * Sign, execute, and await a transaction, then assert it succeeded. Returns the
 * full response with effects/objectChanges/events so callers can mine ids.
 */
import type { Transaction } from '@mysten/sui/transactions';
import { loadKeypair, suiClient } from './env';

export async function signAndExecute(tx: Transaction) {
  const signer = loadKeypair();
  const res = await suiClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true, showEvents: true },
  });
  await suiClient.waitForTransaction({ digest: res.digest });

  const status = res.effects?.status;
  if (status?.status !== 'success') {
    throw new Error(`Transaction ${res.digest} failed: ${status?.error ?? 'unknown error'}`);
  }
  return res;
}

type ObjectChange = NonNullable<Awaited<ReturnType<typeof signAndExecute>>['objectChanges']>[number];

/**
 * Find the id of a `created` object whose Move type matches `typeIncludes` (a
 * substring match, e.g. `::pool::Pool<` or `::balance_manager::BalanceManager`).
 * `extra` lets callers further constrain (e.g. the base coin type for a pool).
 */
export function findCreatedObjectId(
  changes: ObjectChange[] | null | undefined,
  typeIncludes: string,
  extra?: string,
): string | undefined {
  const match = (changes ?? []).find(
    (c): c is Extract<ObjectChange, { type: 'created' }> =>
      c.type === 'created' &&
      c.objectType.includes(typeIncludes) &&
      (extra === undefined || c.objectType.includes(extra)),
  );
  return match?.objectId;
}

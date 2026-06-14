/**
 * Credit yield into the market via the admin-gated `market::accrue`. Stand-in for
 * a real yield source (Scallop receipt / LST rate); the demo keeper calls this a
 * few times and the Walrus writer snapshots the implied APY at each step.
 *
 * Set ACCRUE_AMOUNT_BASE (raw base units of the underlying) in .env, then:
 *   npm run accrue
 */
import { Transaction } from '@mysten/sui/transactions';
import { loadAddress, suiClient } from './env';
import { signAndExecute } from './execute';
import { loadDeployment, requirePackage } from './deployment';

async function main() {
  const d = loadDeployment();
  const pkg = requirePackage(d);
  if (!d.marketId) throw new Error('deployment.marketId is not set.');
  if (!d.adminCapId) throw new Error('deployment.adminCapId is not set.');
  if (!d.underlyingType) throw new Error('deployment.underlyingType is not set.');

  const amount = BigInt(process.env.ACCRUE_AMOUNT_BASE ?? '0');
  if (amount <= 0n) throw new Error('Set ACCRUE_AMOUNT_BASE (raw base units) in .env.');

  const address = loadAddress();
  const isSui = d.underlyingType.replace(/^0x0+/, '0x') === '0x2::sui::SUI';

  const tx = new Transaction();
  let yieldIn;
  if (isSui) {
    [yieldIn] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  } else {
    const { data: coins } = await suiClient.getCoins({ owner: address, coinType: d.underlyingType });
    const total = coins.reduce((acc, c) => acc + BigInt(c.balance), 0n);
    if (total < amount) throw new Error(`Insufficient underlying: have ${total}, need ${amount}.`);
    const [primary, ...rest] = coins;
    const primaryArg = tx.object(primary.coinObjectId);
    if (rest.length > 0) tx.mergeCoins(primaryArg, rest.map((c) => tx.object(c.coinObjectId)));
    [yieldIn] = tx.splitCoins(primaryArg, [tx.pure.u64(amount)]);
  }

  tx.moveCall({
    target: `${pkg}::market::accrue`,
    typeArguments: [d.underlyingType],
    arguments: [tx.object(d.marketId), tx.object(d.adminCapId), yieldIn],
  });

  const res = await signAndExecute(tx);
  console.log(`✓ Accrued ${amount} of yield into the market (tx ${res.digest})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

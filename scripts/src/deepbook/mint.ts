/**
 * Helper: mint PT + YT for the seeder by calling Splyt's `split_for_sender` on
 * an amount of the underlying. The DeepBook seed step needs PT/YT inventory in
 * the wallet before it can deposit them into the BalanceManager.
 *
 * Set MINT_AMOUNT_BASE (raw base units of the underlying) in .env, then:
 *   npm run deepbook:mint   # (or: tsx src/deepbook/mint.ts)
 *
 * This deposits `MINT_AMOUNT_BASE` of underlying into the market and returns
 * equal PT and YT to the sender.
 */
import { Transaction } from '@mysten/sui/transactions';
import { loadAddress, suiClient } from '../env';
import { signAndExecute } from '../execute';
import { loadDeployment, requirePackage } from '../deployment';

const CLOCK = '0x6';

async function main() {
  const d = loadDeployment();
  const pkg = requirePackage(d);
  if (!d.marketId) throw new Error('deployment.marketId is not set — create the market first.');
  if (!d.underlyingType) throw new Error('deployment.underlyingType is not set.');

  const amount = BigInt(process.env.MINT_AMOUNT_BASE ?? '0');
  if (amount <= 0n) throw new Error('Set MINT_AMOUNT_BASE (raw base units of the underlying) in .env.');

  const address = loadAddress();
  // SUI is both gas and (here) the underlying, so we can't consume every SUI
  // coin as an input — split the deposit straight off the gas coin and let the
  // remainder pay gas.
  const isSui = d.underlyingType.replace(/^0x0+/, '0x') === '0x2::sui::SUI';

  const tx = new Transaction();
  let deposit;
  if (isSui) {
    [deposit] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  } else {
    const { data: coins } = await suiClient.getCoins({ owner: address, coinType: d.underlyingType });
    if (coins.length === 0) throw new Error(`No ${d.underlyingType} coins in ${address}.`);
    const total = coins.reduce((acc, c) => acc + BigInt(c.balance), 0n);
    if (total < amount) {
      throw new Error(`Insufficient underlying: have ${total}, need ${amount} base units.`);
    }
    // Consolidate into the first coin, then split off the exact deposit amount.
    const [primary, ...rest] = coins;
    const primaryArg = tx.object(primary.coinObjectId);
    if (rest.length > 0) {
      tx.mergeCoins(primaryArg, rest.map((c) => tx.object(c.coinObjectId)));
    }
    [deposit] = tx.splitCoins(primaryArg, [tx.pure.u64(amount)]);
  }

  tx.moveCall({
    target: `${pkg}::market::split_for_sender`,
    typeArguments: [d.underlyingType],
    arguments: [tx.object(d.marketId), deposit, tx.object(CLOCK)],
  });

  const res = await signAndExecute(tx);
  console.log(`✓ Minted ${amount} PT and ${amount} YT to ${address} (tx ${res.digest})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

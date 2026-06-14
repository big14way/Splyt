/**
 * Acquire testnet DEEP by swapping SUI on the whitelisted DEEP_SUI pool (no DEEP
 * needed to trade a whitelisted pool). Testnet DEEP is scarce — this pool only
 * holds ~20 DEEP — but that is enough to demonstrate live trading.
 *
 * Set DEEP_SWAP_SUI (human SUI to spend, default 1) in .env, then:
 *   npm run deepbook:get-deep
 */
import { testnetCoins } from '@mysten/deepbook-v3';
import { Transaction } from '@mysten/sui/transactions';
import { loadAddress, suiClient } from '../env';
import { signAndExecute } from '../execute';
import { buildSplytDeepBook } from './config';

const SUI_SCALAR = 1_000_000_000;
const DEEP_SCALAR = 1_000_000;

async function main() {
  const address = loadAddress();
  const { db } = buildSplytDeepBook(address);

  const sui = Number(process.env.DEEP_SWAP_SUI ?? 1);
  const tx = new Transaction();

  // Pay the SUI input by splitting off the gas coin (SUI is also gas), so we
  // don't fight the gas-coin selection.
  const [quoteCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(Math.floor(sui * SUI_SCALAR))]);

  const [deepOut, suiRemainder, deepFeeRemainder] = db.deepBook.swapExactQuoteForBase({
    poolKey: 'DEEP_SUI',
    amount: sui,
    deepAmount: 0, // whitelisted pool: no DEEP fee
    minOut: 0, // testnet demo: accept any output
    quoteCoin,
  })(tx);

  tx.transferObjects([deepOut, suiRemainder, deepFeeRemainder], address);

  const res = await signAndExecute(tx);
  console.log(`✓ Swapped up to ${sui} SUI for DEEP on DEEP_SUI (tx ${res.digest})`);

  const { data: deepCoins } = await suiClient.getCoins({ owner: address, coinType: testnetCoins.DEEP.type });
  const total = deepCoins.reduce((acc, c) => acc + BigInt(c.balance), 0n);
  console.log(`  DEEP balance now: ${Number(total) / DEEP_SCALAR} DEEP`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

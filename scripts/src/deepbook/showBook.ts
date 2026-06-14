/**
 * Read and print the PT/USDC and YT/USDC order books. Doubles as a smoke test
 * that `getOrderBook` (the frontend read helper) works against the live pools.
 *
 *   npm run deepbook:book
 */
import { READ_ONLY_ADDRESS } from '../env';
import { buildSplytDeepBook, PT_POOL_KEY, YT_POOL_KEY } from './config';
import { getOrderBook } from './trade';

function printBook(label: string, book: Awaited<ReturnType<typeof getOrderBook>>) {
  console.log(`\n=== ${label} ===  mid: ${book.mid ?? 'n/a'}`);
  console.log('  asks (low → high):');
  [...book.asks]
    .sort((a, b) => a.price - b.price)
    .forEach((l) => console.log(`    ${l.price.toFixed(4)}  x ${l.size}`));
  console.log('  bids (high → low):');
  [...book.bids]
    .sort((a, b) => b.price - a.price)
    .forEach((l) => console.log(`    ${l.price.toFixed(4)}  x ${l.size}`));
}

async function main() {
  const { db } = buildSplytDeepBook(READ_ONLY_ADDRESS);
  printBook('PT / USDC', await getOrderBook(db, PT_POOL_KEY));
  printBook('YT / USDC', await getOrderBook(db, YT_POOL_KEY));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

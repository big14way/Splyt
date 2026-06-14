/**
 * Live end-to-end demonstration of the DeepBook trade integration — deposit,
 * placeOrder, read the book, cancelOrder — exercising the exact helpers the
 * frontend imports (src/deepbook/trade.ts).
 *
 * It runs against an existing pool (default DEEP_SUI) because creating our own
 * PT/USDC + YT/USDC pools needs 500 DEEP each and testnet DEEP is too scarce.
 * The integration code is identical; only the pool differs.
 *
 * Prereqs: seeder BalanceManager (`npm run deepbook:bm`) and some DEEP
 * (`npm run deepbook:get-deep`).
 *
 *   npm run deepbook:demo
 */
import { Transaction } from '@mysten/sui/transactions';
import { loadAddress } from '../env';
import { signAndExecute } from '../execute';
import { buildSplytDeepBook, SEEDER_KEY } from './config';
import { cancelOrder, getOrderBook, placeOrder } from './trade';

const POOL = process.env.DEMO_POOL ?? 'DEEP_SUI';
const DEPOSIT_DEEP = Number(process.env.DEMO_DEPOSIT_DEEP ?? 15);
// Sell price well above market (~0.023 SUI/DEEP) so the order rests as a maker.
const SELL_PRICE = Number(process.env.DEMO_SELL_PRICE ?? 0.1);

function roundToTick(p: number, tick: number): number {
  return Math.round(p / tick) * tick;
}

async function main() {
  const address = loadAddress();
  const { db } = buildSplytDeepBook(address);

  const params = await db.poolBookParams(POOL);
  const price = roundToTick(SELL_PRICE, params.tickSize);
  const size = Math.max(params.minSize, params.lotSize); // DEEP_SUI minSize = 10
  console.log(`Pool ${POOL}: tick=${params.tickSize} lot=${params.lotSize} min=${params.minSize}`);

  // 1) deposit DEEP inventory into the seeder BalanceManager
  {
    const tx = new Transaction();
    db.balanceManager.depositIntoManager(SEEDER_KEY, 'DEEP', DEPOSIT_DEEP)(tx);
    const res = await signAndExecute(tx);
    console.log(`✓ Deposited ${DEPOSIT_DEEP} DEEP into the seeder BM (tx ${res.digest})`);
  }

  // 2) place a maker SELL order via the frontend-facing helper
  {
    const tx = new Transaction();
    placeOrder(db, {
      pool: POOL,
      side: 'sell',
      price,
      size,
      balanceManagerKey: SEEDER_KEY,
      clientOrderId: '777',
      payWithDeep: false,
    })(tx);
    const res = await signAndExecute(tx);
    console.log(`✓ Placed SELL ${size} @ ${price} on ${POOL} (tx ${res.digest})`);
  }

  // 3) confirm it is live: open orders + the ask shows up in getOrderBook
  const open = await db.accountOpenOrders(POOL, SEEDER_KEY);
  console.log(`✓ Open orders for seeder: ${open.length}`);
  const book = await getOrderBook(db, POOL);
  const ours = book.asks.filter((a) => Math.abs(a.price - price) < params.tickSize / 2);
  console.log(`✓ Our ask in the book:`, ours.length ? ours : '(matched/!found)');

  // 4) cancel via the frontend-facing helper
  if (open.length > 0) {
    const tx = new Transaction();
    for (const id of open) cancelOrder(db, POOL, id, SEEDER_KEY)(tx);
    const res = await signAndExecute(tx);
    console.log(`✓ Cancelled ${open.length} order(s) (tx ${res.digest})`);
  }

  console.log('\nDeepBook trade path verified live: deposit → placeOrder → getOrderBook → cancelOrder.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

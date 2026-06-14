/**
 * Step 2 of the DeepBook listing: stand up a seeder BalanceManager, fund it with
 * PT / YT / quote, and post a couple of maker orders on each pool so the books
 * are not empty for the demo.
 *
 * PT asks sit below par (implied fixed yield); YT trades around its expected
 * value. Amounts and prices are env-overridable (see .env.example).
 *
 * Prereqs: pools created (`npm run deepbook:pools`), and the seeder already
 * holds PT, YT, quote, and a little DEEP. Mint PT/YT with `npm run deepbook:mint`.
 *
 *   npm run deepbook:seed
 */
import { Transaction } from '@mysten/sui/transactions';
import { loadAddress } from '../env';
import { signAndExecute, findCreatedObjectId } from '../execute';
import { loadDeployment, updateDeployment } from '../deployment';
import { buildSplytDeepBook, PT_POOL_KEY, SEEDER_KEY, YT_POOL_KEY } from './config';

const num = (name: string, fallback: number) => Number(process.env[name] ?? fallback);
const PAY_WITH_DEEP = (process.env.SEED_PAY_WITH_DEEP ?? 'false') === 'true';

// Deposit sizes (human units).
const SEED_PT = num('SEED_PT', 500);
const SEED_YT = num('SEED_YT', 500);
const SEED_QUOTE = num('SEED_QUOTE', 500);

interface MakerOrder {
  pool: string;
  price: number;
  size: number;
  isBid: boolean;
}

// PT below par => implied fixed yield. YT priced around the yield it captures.
function makerOrders(): MakerOrder[] {
  const ptSize = num('SEED_ORDER_SIZE', 100);
  const ytSize = num('SEED_ORDER_SIZE', 100);
  return [
    // PT/USDC: bids under, asks just below par.
    { pool: PT_POOL_KEY, price: num('PT_BID_1', 0.95), size: ptSize, isBid: true },
    { pool: PT_POOL_KEY, price: num('PT_BID_2', 0.96), size: ptSize, isBid: true },
    { pool: PT_POOL_KEY, price: num('PT_ASK_1', 0.97), size: ptSize, isBid: false },
    { pool: PT_POOL_KEY, price: num('PT_ASK_2', 0.98), size: ptSize, isBid: false },
    // YT/USDC: bids/asks straddling the expected yield value.
    { pool: YT_POOL_KEY, price: num('YT_BID_1', 0.03), size: ytSize, isBid: true },
    { pool: YT_POOL_KEY, price: num('YT_BID_2', 0.035), size: ytSize, isBid: true },
    { pool: YT_POOL_KEY, price: num('YT_ASK_1', 0.045), size: ytSize, isBid: false },
    { pool: YT_POOL_KEY, price: num('YT_ASK_2', 0.05), size: ytSize, isBid: false },
  ];
}

async function ensureBalanceManager(): Promise<string> {
  const existing = loadDeployment().balanceManagerId;
  if (existing) {
    console.log(`✓ BalanceManager already exists: ${existing}`);
    return existing;
  }
  const { db } = buildSplytDeepBook(loadAddress());
  const tx = new Transaction();
  db.balanceManager.createAndShareBalanceManager()(tx);
  const res = await signAndExecute(tx);
  const id = findCreatedObjectId(res.objectChanges, '::balance_manager::BalanceManager');
  if (!id) throw new Error(`Could not find created BalanceManager in tx ${res.digest}.`);
  updateDeployment({ balanceManagerId: id });
  console.log(`✓ BalanceManager created: ${id} (tx ${res.digest})`);
  return id;
}

async function depositInventory() {
  const { db, quoteCoinKey } = buildSplytDeepBook(loadAddress());
  const tx = new Transaction();
  db.balanceManager.depositIntoManager(SEEDER_KEY, 'PT', SEED_PT)(tx);
  db.balanceManager.depositIntoManager(SEEDER_KEY, 'YT', SEED_YT)(tx);
  db.balanceManager.depositIntoManager(SEEDER_KEY, quoteCoinKey, SEED_QUOTE)(tx);
  const res = await signAndExecute(tx);
  console.log(
    `✓ Deposited ${SEED_PT} PT, ${SEED_YT} YT, ${SEED_QUOTE} ${quoteCoinKey} (tx ${res.digest})`,
  );
}

async function placeMakerOrders() {
  const { db } = buildSplytDeepBook(loadAddress());
  const orders = makerOrders();
  const tx = new Transaction();
  orders.forEach((o, i) => {
    db.deepBook.placeLimitOrder({
      poolKey: o.pool,
      balanceManagerKey: SEEDER_KEY,
      clientOrderId: String(i + 1),
      price: o.price,
      quantity: o.size,
      isBid: o.isBid,
      payWithDeep: PAY_WITH_DEEP,
    })(tx);
  });
  const res = await signAndExecute(tx);
  console.log(`✓ Placed ${orders.length} maker orders (tx ${res.digest})`);
  orders.forEach((o) =>
    console.log(`   ${o.pool} ${o.isBid ? 'BID' : 'ASK'} ${o.size} @ ${o.price}`),
  );
}

async function main() {
  const d = loadDeployment();
  if (!d.pools?.[PT_POOL_KEY] || !d.pools?.[YT_POOL_KEY]) {
    throw new Error('Pools not found in deployment.json — run `npm run deepbook:pools` first.');
  }
  await ensureBalanceManager();
  await depositInventory();
  await placeMakerOrders();
  console.log('\nBooks seeded. Inspect with `npm run deepbook:book`.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

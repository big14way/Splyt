/**
 * Reusable PT/YT trade helpers built on `@mysten/deepbook-v3`.
 *
 * This is the module the frontend imports (see docs/DEEPBOOK_INTEGRATION.md,
 * "What to hand the frontend"): a `placeOrder` / `cancelOrder` that return a
 * `Transaction` to sign, plus a `getOrderBook` read for rendering bids/asks.
 *
 * Splyt has no on-chain trade call — PT and YT trade purely on DeepBook, so
 * everything here goes through `DeepBookClient`.
 */
import type { DeepBookClient } from '@mysten/deepbook-v3';
import { OrderType, SelfMatchingOptions } from '@mysten/deepbook-v3';
import type { Transaction } from '@mysten/sui/transactions';

export type Side = 'buy' | 'sell';

export interface PlaceOrderArgs {
  /** Pool key, e.g. 'PT_USDC' or 'YT_USDC'. */
  pool: string;
  side: Side;
  /** Quote per base (e.g. 0.97 USDC per PT). */
  price: number;
  /** Base quantity, in human units (e.g. 100 PT). */
  size: number;
  /** Balance manager key; defaults to the connected user's 'USER' manager. */
  balanceManagerKey?: string;
  /** Client-supplied order id (any unique string). */
  clientOrderId?: string;
  /** Pay DeepBook fees in DEEP (true) or the input token (false). */
  payWithDeep?: boolean;
}

/** Returns a thunk that adds a maker/taker limit order to a Transaction. */
export function placeOrder(db: DeepBookClient, args: PlaceOrderArgs) {
  const {
    pool,
    side,
    price,
    size,
    balanceManagerKey = 'USER',
    clientOrderId = String(Date.now()),
    payWithDeep = true,
  } = args;

  return (tx: Transaction) =>
    db.deepBook.placeLimitOrder({
      poolKey: pool,
      balanceManagerKey,
      clientOrderId,
      price,
      quantity: size,
      isBid: side === 'buy',
      orderType: OrderType.NO_RESTRICTION,
      selfMatchingOption: SelfMatchingOptions.SELF_MATCHING_ALLOWED,
      payWithDeep,
    })(tx);
}

export function cancelOrder(
  db: DeepBookClient,
  pool: string,
  orderId: string,
  balanceManagerKey = 'USER',
) {
  return (tx: Transaction) => db.deepBook.cancelOrder(pool, balanceManagerKey, orderId)(tx);
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  pool: string;
  mid: number | null;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

/**
 * Read the level-2 book around the mid for rendering. `ticks` is how many price
 * levels to fetch on each side.
 */
export async function getOrderBook(db: DeepBookClient, pool: string, ticks = 12): Promise<OrderBook> {
  const book = await db.getLevel2TicksFromMid(pool, ticks);
  const bids: OrderBookLevel[] = book.bid_prices.map((price, i) => ({
    price,
    size: book.bid_quantities[i] ?? 0,
  }));
  const asks: OrderBookLevel[] = book.ask_prices.map((price, i) => ({
    price,
    size: book.ask_quantities[i] ?? 0,
  }));

  let mid: number | null = null;
  try {
    mid = await db.midPrice(pool);
  } catch {
    // No two-sided book yet — mid is undefined until both sides have liquidity.
    mid = null;
  }

  return { pool, mid, bids, asks };
}

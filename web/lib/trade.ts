/**
 * Transaction builders for DeepBook trading (the Trade page).
 *
 *   Create account — one-time BalanceManager per user.
 *   Place order    — deposit the needed coin + place a limit order, one PTB.
 *   Cancel order   — cancel a resting order, returning locked funds to the BM.
 *
 * Ports `scripts/src/deepbook/trade.ts` (proven live in demoTrade.ts) to the
 * frontend. Amounts here are *human units* — the SDK scales by the coin's
 * decimals.
 */
import { OrderType, SelfMatchingOptions } from "@mysten/deepbook-v3";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { DEEPBOOK_PACKAGE_ID, USER_BM_KEY, buildDeepBook } from "./deepbook";

export type Side = "buy" | "sell";

/**
 * Create a BalanceManager *owned by* the user (run once). The SDK's
 * `createAndShareBalanceManager` shares it, which the registry-based
 * `getBalanceManagerIds` doesn't reliably surface — an owned manager is found
 * deterministically via `getOwnedObjects`, and its owner (the user) can trade
 * with it directly.
 */
export function buildCreateBalanceManager(address: string): Transaction {
  const tx = new Transaction();
  const manager = tx.moveCall({ target: `${DEEPBOOK_PACKAGE_ID}::balance_manager::new` });
  tx.transferObjects([manager], tx.pure.address(address));
  return tx;
}

export interface PlaceOrderArgs {
  client: SuiJsonRpcClient;
  address: string;
  balanceManagerId: string;
  poolKey: string;
  side: Side;
  /** Quote per base (already rounded to the pool tick). */
  price: number;
  /** Base quantity (already rounded to the pool lot). */
  size: number;
  /** Coin key to deposit (quote for buy, base for sell). */
  depositCoinKey: string;
  /** Human amount of depositCoinKey to deposit to fund the order. */
  depositAmount: number;
}

export function buildPlaceOrder({
  client,
  address,
  balanceManagerId,
  poolKey,
  side,
  price,
  size,
  depositCoinKey,
  depositAmount,
}: PlaceOrderArgs): Transaction {
  const db = buildDeepBook(client, address, balanceManagerId);
  const tx = new Transaction();
  db.balanceManager.depositIntoManager(USER_BM_KEY, depositCoinKey, depositAmount)(tx);
  db.deepBook.placeLimitOrder({
    poolKey,
    balanceManagerKey: USER_BM_KEY,
    clientOrderId: String(Date.now()),
    price,
    quantity: size,
    isBid: side === "buy",
    orderType: OrderType.NO_RESTRICTION,
    selfMatchingOption: SelfMatchingOptions.SELF_MATCHING_ALLOWED,
    payWithDeep: false,
  })(tx);
  return tx;
}

export function buildCancelOrder(
  client: SuiJsonRpcClient,
  address: string,
  balanceManagerId: string,
  poolKey: string,
  orderId: string,
): Transaction {
  const db = buildDeepBook(client, address, balanceManagerId);
  const tx = new Transaction();
  db.deepBook.cancelOrder(poolKey, USER_BM_KEY, orderId)(tx);
  return tx;
}

/** Withdraw the full balance of `coinKey` from the manager back to the wallet. */
export function buildWithdrawAll(
  client: SuiJsonRpcClient,
  address: string,
  balanceManagerId: string,
  coinKey: string,
): Transaction {
  const db = buildDeepBook(client, address, balanceManagerId);
  const tx = new Transaction();
  db.balanceManager.withdrawAllFromManager(USER_BM_KEY, coinKey, address)(tx);
  return tx;
}

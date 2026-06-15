/**
 * Transaction builders for the four core actions.
 *
 *   Split   — deposit U, mint equal PT + YT to sender.
 *   Combine — burn equal PT + YT, return U to sender (pre-maturity only).
 *   Redeem PT / Redeem YT — burn, return U or pro-rata yield (post-maturity).
 *
 * Each builder returns a `Transaction` ready for `useSignAndExecuteTransaction`.
 * UI callers should pass amounts in *base units* (bigint) so we never round.
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  CLOCK,
  MARKET,
  PKG,
  UNDERLYING_TYPE,
} from "./config";

/**
 * Build a Split tx that splits `amount` base units off the user's gas coin and
 * deposits the result. Works because UNDERLYING_TYPE is SUI on this deployment;
 * a non-SUI underlying would need a coin picker (find Coin<U>, split off it).
 */
export function buildSplit(amount: bigint): Transaction {
  const tx = new Transaction();
  const [deposit] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  tx.moveCall({
    target: `${PKG}::market::split_for_sender`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), deposit, tx.object(CLOCK)],
  });
  return tx;
}

/**
 * Build a Combine tx: merge any extra PT/YT coins into the primary objects,
 * split exactly `amount` off each, call market::combine, transfer the
 * returned Coin<U> to the sender.
 */
export interface BuildCombineArgs {
  amount: bigint;
  sender: string;
  ptCoinIds: string[];
  ytCoinIds: string[];
}

export function buildCombine({
  amount,
  sender,
  ptCoinIds,
  ytCoinIds,
}: BuildCombineArgs): Transaction {
  if (ptCoinIds.length === 0 || ytCoinIds.length === 0) {
    throw new Error("buildCombine: missing PT or YT coin");
  }
  const tx = new Transaction();
  const ptPrimary = tx.object(ptCoinIds[0]!);
  const ytPrimary = tx.object(ytCoinIds[0]!);
  if (ptCoinIds.length > 1) {
    tx.mergeCoins(
      ptPrimary,
      ptCoinIds.slice(1).map((id) => tx.object(id)),
    );
  }
  if (ytCoinIds.length > 1) {
    tx.mergeCoins(
      ytPrimary,
      ytCoinIds.slice(1).map((id) => tx.object(id)),
    );
  }
  const [ptIn] = tx.splitCoins(ptPrimary, [tx.pure.u64(amount)]);
  const [ytIn] = tx.splitCoins(ytPrimary, [tx.pure.u64(amount)]);
  const out = tx.moveCall({
    target: `${PKG}::market::combine`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), ptIn, ytIn, tx.object(CLOCK)],
  });
  tx.transferObjects([out], tx.pure.address(sender));
  return tx;
}

/**
 * Settle the market once the clock has passed maturity. Anyone can call this;
 * it's a one-shot toggle that snapshots final_yield and final_yt_supply so
 * subsequent redeem_yt payouts are fair regardless of order.
 */
export function buildMature(): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PKG}::market::mature`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), tx.object(CLOCK)],
  });
  return tx;
}

/** Merge a list of coin objects into the first one and return the primary arg. */
function mergePrimary(tx: Transaction, coinIds: string[]) {
  const primary = tx.object(coinIds[0]!);
  if (coinIds.length > 1) {
    tx.mergeCoins(
      primary,
      coinIds.slice(1).map((id) => tx.object(id)),
    );
  }
  return primary;
}

/** Redeem PT post-maturity. Splits `amount` off the merged PT primary. */
export function buildRedeemPt(ptCoinIds: string[], amount: bigint): Transaction {
  if (ptCoinIds.length === 0) throw new Error("buildRedeemPt: no PT coins");
  const tx = new Transaction();
  const primary = mergePrimary(tx, ptCoinIds);
  const [redeem] = tx.splitCoins(primary, [tx.pure.u64(amount)]);
  tx.moveCall({
    target: `${PKG}::market::redeem_pt_for_sender`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), redeem],
  });
  return tx;
}

/** Redeem YT post-maturity. Splits `amount` off the merged YT primary. */
export function buildRedeemYt(ytCoinIds: string[], amount: bigint): Transaction {
  if (ytCoinIds.length === 0) throw new Error("buildRedeemYt: no YT coins");
  const tx = new Transaction();
  const primary = mergePrimary(tx, ytCoinIds);
  const [redeem] = tx.splitCoins(primary, [tx.pure.u64(amount)]);
  tx.moveCall({
    target: `${PKG}::market::redeem_yt_for_sender`,
    typeArguments: [UNDERLYING_TYPE],
    arguments: [tx.object(MARKET), redeem],
  });
  return tx;
}

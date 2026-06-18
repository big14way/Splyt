/**
 * Build a `DeepBookClient` that knows about Splyt's PT and YT coins.
 *
 * Mirrors `scripts/src/deepbook/config.ts` from the contracts owner's track:
 * spreads the SDK's default testnet maps so DEEP / SUI / DBUSDC stay
 * resolvable, then registers PT and YT. PT/USDC and YT/USDC pool entries are
 * declared but reference empty addresses until pool creation is unblocked on
 * testnet — the UI surfaces that as an "Awaiting pool" empty state and reads
 * still work against DEEP_SUI (the whitelisted pool the trade path was proven
 * against in scripts/src/deepbook/demoTrade.ts).
 *
 * Pass the connected wallet's BalanceManager id to register it under
 * `USER_BM_KEY` so deposit / place / cancel can act on it.
 */
import {
  DeepBookClient,
  testnetCoins,
  testnetPackageIds,
  testnetPools,
  type CoinMap,
  type PoolMap,
} from "@mysten/deepbook-v3";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import {
  NETWORK,
  PKG,
  PT_DECIMALS,
  PT_POOL,
  PT_TYPE,
  QUOTE_COIN_KEY,
  YT_DECIMALS,
  YT_POOL,
  YT_TYPE,
} from "./config";

/** PT/USDC and YT/USDC pool ids (empty until creation on testnet). */
export const PT_USDC_POOL_ADDRESS = "";
export const YT_USDC_POOL_ADDRESS = "";

/** Key the connected user's BalanceManager is registered under. */
export const USER_BM_KEY = "USER";

/** DeepBook package (current) — target for `balance_manager::new`. */
export const DEEPBOOK_PACKAGE_ID = testnetPackageIds.DEEPBOOK_PACKAGE_ID!;

/**
 * Testnet BalanceManager struct type (its *original* package id, which differs
 * from the current `DEEPBOOK_PACKAGE_ID` after upgrades). Used to find the
 * user's owned manager via `getOwnedObjects`. Update for mainnet.
 */
export const BALANCE_MANAGER_TYPE =
  "0xfb28c4cbc6865bd1c897d26aecbe1f8792d1509a20ffec692c800660cbec6982::balance_manager::BalanceManager";

const COINS: CoinMap = {
  ...testnetCoins,
  PT: { address: PKG, type: PT_TYPE, scalar: 10 ** PT_DECIMALS },
  YT: { address: PKG, type: YT_TYPE, scalar: 10 ** YT_DECIMALS },
};

const POOLS_CFG: PoolMap = {
  ...testnetPools,
  [PT_POOL]: {
    address: PT_USDC_POOL_ADDRESS,
    baseCoin: "PT",
    quoteCoin: QUOTE_COIN_KEY,
  },
  [YT_POOL]: {
    address: YT_USDC_POOL_ADDRESS,
    baseCoin: "YT",
    quoteCoin: QUOTE_COIN_KEY,
  },
};

export function buildDeepBook(
  client: SuiJsonRpcClient,
  address: string,
  balanceManagerId?: string,
): DeepBookClient {
  return new DeepBookClient({
    client,
    address,
    network: NETWORK,
    coins: COINS,
    pools: POOLS_CFG,
    balanceManagers: balanceManagerId
      ? { [USER_BM_KEY]: { address: balanceManagerId } }
      : undefined,
  });
}

/** Full Move type for a DeepBook coin key (PT, YT, SUI, DEEP, DBUSDC…). */
export function coinTypeForKey(key: string): string {
  const coin = COINS[key];
  if (!coin) throw new Error(`Unknown coin key: ${key}`);
  return coin.type;
}

/** Decimal scalar (10**decimals) for a DeepBook coin key. */
export function coinScalarForKey(key: string): number {
  const coin = COINS[key];
  if (!coin) throw new Error(`Unknown coin key: ${key}`);
  return coin.scalar;
}

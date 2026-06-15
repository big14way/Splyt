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
 */
import {
  DeepBookClient,
  testnetCoins,
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

export function buildDeepBook(
  client: SuiJsonRpcClient,
  address: string,
): DeepBookClient {
  const coins: CoinMap = {
    ...testnetCoins,
    PT: { address: PKG, type: PT_TYPE, scalar: 10 ** PT_DECIMALS },
    YT: { address: PKG, type: YT_TYPE, scalar: 10 ** YT_DECIMALS },
  };

  const pools: PoolMap = {
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

  return new DeepBookClient({
    client,
    address,
    network: NETWORK,
    coins,
    pools,
  });
}

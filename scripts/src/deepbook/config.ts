/**
 * Build a `DeepBookClient` that knows about Splyt's PT and YT coins and their
 * two pools (PT/USDC, YT/USDC). This is the shared module the seed/trade
 * scripts use, and its `coins`/`pools` maps are exactly what the frontend needs
 * to construct its own `DeepBookClient`.
 *
 * Note: the SDK *replaces* its default coin/pool maps when you pass `coins` or
 * `pools` (it is `coins || defaultCoins`, not a merge), so we spread the network
 * defaults first to keep DEEP / SUI / DBUSDC resolvable, then add PT and YT.
 */
import {
  DeepBookClient,
  mainnetCoins,
  mainnetPools,
  testnetCoins,
  testnetPools,
  type CoinMap,
  type PoolMap,
} from '@mysten/deepbook-v3';
import { NETWORK, QUOTE_COIN_KEY, suiClient } from '../env';
import { loadDeployment, ptType, requirePackage, ytType, type Deployment } from '../deployment';

export const PT_POOL_KEY = 'PT_USDC';
export const YT_POOL_KEY = 'YT_USDC';
export const SEEDER_KEY = 'SEEDER';

function defaultCoins(): CoinMap {
  return NETWORK === 'mainnet' ? mainnetCoins : testnetCoins;
}
function defaultPools(): PoolMap {
  return NETWORK === 'mainnet' ? mainnetPools : testnetPools;
}

export interface SplytDeepBook {
  db: DeepBookClient;
  coins: CoinMap;
  pools: PoolMap;
  quoteCoinKey: string;
  ptType: string;
  ytType: string;
  deployment: Deployment;
}

/**
 * @param address  the sender address (seeder for scripts; the connected wallet
 *                 in the frontend).
 */
export function buildSplytDeepBook(address: string): SplytDeepBook {
  const d = loadDeployment();
  const pkg = requirePackage(d);
  const quoteCoinKey = d.quoteCoinKey ?? QUOTE_COIN_KEY;
  const PT_TYPE = ptType(d);
  const YT_TYPE = ytType(d);

  const coins: CoinMap = {
    ...defaultCoins(),
    PT: { address: pkg, type: PT_TYPE, scalar: 10 ** (d.ptDecimals ?? 9) },
    YT: { address: pkg, type: YT_TYPE, scalar: 10 ** (d.ytDecimals ?? 9) },
  };

  const pools: PoolMap = {
    ...defaultPools(),
    [PT_POOL_KEY]: { address: d.pools?.[PT_POOL_KEY] ?? '', baseCoin: 'PT', quoteCoin: quoteCoinKey },
    [YT_POOL_KEY]: { address: d.pools?.[YT_POOL_KEY] ?? '', baseCoin: 'YT', quoteCoin: quoteCoinKey },
  };

  const balanceManagers = d.balanceManagerId
    ? { [SEEDER_KEY]: { address: d.balanceManagerId } }
    : undefined;

  const db = new DeepBookClient({
    client: suiClient,
    address,
    network: NETWORK,
    coins,
    pools,
    balanceManagers,
  });

  return { db, coins, pools, quoteCoinKey, ptType: PT_TYPE, ytType: YT_TYPE, deployment: d };
}

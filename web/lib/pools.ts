/**
 * Descriptors for every pool the Trade page knows about. PT/USDC and YT/USDC
 * are Splyt's own pools (awaiting DEEP on testnet); DEEP/SUI is the
 * whitelisted DeepBook pool the trade integration was proven on live.
 */
import { PT_POOL, QUOTE_COIN_KEY, YT_POOL } from "./config";

export type PoolStatus = "live" | "awaiting";

export interface PoolDescriptor {
  /** DeepBook pool key as registered on the client. */
  key: string;
  /** Display label (e.g. "PT / DBUSDC"). */
  label: string;
  baseColor: string;
  quoteColor: string;
  baseSymbol: string;
  quoteSymbol: string;
  status: PoolStatus;
  /** Brand color of the side that matters most (PT or YT for our pools). */
  accent: string;
  /** When `awaiting`, this short note explains why. */
  note?: string;
}

export const POOLS: PoolDescriptor[] = [
  {
    key: PT_POOL,
    label: `PT / ${QUOTE_COIN_KEY}`,
    baseSymbol: "PT",
    quoteSymbol: QUOTE_COIN_KEY,
    baseColor: "var(--pt)",
    quoteColor: "var(--text-dim)",
    accent: "var(--pt)",
    status: "awaiting",
    note: "Pool creation costs 500 DEEP — pending a testnet DEEP grant.",
  },
  {
    key: YT_POOL,
    label: `YT / ${QUOTE_COIN_KEY}`,
    baseSymbol: "YT",
    quoteSymbol: QUOTE_COIN_KEY,
    baseColor: "var(--yt)",
    quoteColor: "var(--text-dim)",
    accent: "var(--yt)",
    status: "awaiting",
    note: "Pool creation costs 500 DEEP — pending a testnet DEEP grant.",
  },
  {
    key: "DEEP_SUI",
    label: "DEEP / SUI",
    baseSymbol: "DEEP",
    quoteSymbol: "SUI",
    baseColor: "var(--sui)",
    quoteColor: "var(--text-dim)",
    accent: "var(--sui)",
    status: "live",
    note: "Whitelisted DeepBook testnet pool. The same path PT/YT will trade on.",
  },
];

export function findPool(key: string): PoolDescriptor | undefined {
  return POOLS.find((p) => p.key === key);
}

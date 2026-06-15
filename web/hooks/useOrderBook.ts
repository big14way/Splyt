"use client";

import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { buildDeepBook } from "@/lib/deepbook";
import { findPool } from "@/lib/pools";

const READ_ONLY_ADDR =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  pool: string;
  mid: number | null;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

/**
 * Read the level-2 book around mid plus the mid price for a pool.
 *
 * Mirrors `scripts/src/deepbook/trade.ts:getOrderBook`. Pools that don't exist
 * yet on testnet (PT_USDC, YT_USDC) skip the call and return an empty snapshot;
 * the UI shows an "Awaiting pool" state instead of an SDK error.
 */
export function useOrderBook(
  poolKey: string,
  ticks = 12,
): UseQueryResult<OrderBookSnapshot, Error> {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const address = account?.address ?? READ_ONLY_ADDR;
  const descriptor = findPool(poolKey);
  const live = descriptor?.status === "live";

  return useQuery({
    queryKey: ["splyt", "deepbook", "book", poolKey, address, ticks],
    enabled: !!descriptor,
    staleTime: 4_000,
    refetchInterval: 8_000,
    queryFn: async (): Promise<OrderBookSnapshot> => {
      if (!live) return { pool: poolKey, mid: null, bids: [], asks: [] };
      const db = buildDeepBook(client, address);
      const book = await db.getLevel2TicksFromMid(poolKey, ticks);
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
        mid = await db.midPrice(poolKey);
      } catch {
        mid = null;
      }
      return { pool: poolKey, mid, bids, asks };
    },
  });
}

"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { buildDeepBook } from "@/lib/deepbook";
import { findPool } from "@/lib/pools";

const READ_ONLY_ADDR =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface PoolParams {
  /** Minimum price increment. */
  tickSize: number;
  /** Minimum base-quantity increment. */
  lotSize: number;
  /** Minimum order size, in base units. */
  minSize: number;
}

/**
 * Pool trading constraints (tick / lot / min) for validating and rounding
 * orders. Skipped for pools that don't exist yet on testnet.
 */
export function usePoolParams(
  poolKey: string,
): UseQueryResult<PoolParams | null, Error> {
  const client = useSuiClient();
  const live = findPool(poolKey)?.status === "live";

  return useQuery({
    queryKey: ["splyt", "deepbook", "params", poolKey],
    enabled: live,
    staleTime: 60_000,
    queryFn: async () => {
      if (!live) return null;
      const db = buildDeepBook(client, READ_ONLY_ADDR);
      return db.poolBookParams(poolKey);
    },
  });
}

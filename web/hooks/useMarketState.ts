"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { readMarketState, type MarketState } from "@/lib/views";
import { MARKET } from "@/lib/config";

/**
 * Live market state via devInspect view calls. Cheap (no signer, no gas) and
 * shared across components via react-query's cache.
 */
export function useMarketState(): UseQueryResult<MarketState, Error> {
  const client = useSuiClient();
  return useQuery({
    queryKey: ["splyt", "market", MARKET],
    queryFn: () => readMarketState(client),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

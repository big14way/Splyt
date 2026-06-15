"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { WALRUS_AGGREGATOR } from "@/lib/config";
import { useMarketState } from "./useMarketState";

/** One point of the yield-curve series stored on Walrus. */
export interface YieldPoint {
  /** Unix seconds. */
  t: number;
  impliedApy: number;
  underlyingIndex: number;
  ptMid: number | null;
  ytMid: number | null;
}

export interface YieldHistory {
  blobId: string;
  url: string;
  series: YieldPoint[];
}

export function aggregatorUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}

/**
 * Resolves the latest Walrus blob id from the Market (`yield_history_blob`
 * view) and fetches the JSON series from the public aggregator. Returns
 * null while no blob is committed yet.
 */
export function useYieldHistory(): UseQueryResult<YieldHistory | null, Error> {
  const market = useMarketState();
  const blobId = market.data?.yieldHistoryBlob?.trim() ?? "";

  return useQuery({
    queryKey: ["splyt", "yield-history", blobId],
    enabled: !!blobId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<YieldHistory | null> => {
      if (!blobId) return null;
      const url = aggregatorUrl(blobId);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Walrus aggregator ${r.status}`);
      const series = (await r.json()) as YieldPoint[];
      if (!Array.isArray(series)) {
        throw new Error("Walrus blob is not a YieldPoint[] array");
      }
      return { blobId, url, series };
    },
  });
}

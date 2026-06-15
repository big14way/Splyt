"use client";

import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/** Slim CoinStruct view used by combine/redeem builders. */
export interface OwnedCoin {
  coinObjectId: string;
  balance: bigint;
}

/**
 * Paginated list of the user's coins of `coinType`, totaled. Returns null
 * when no wallet is connected.
 */
export function useCoins(coinType: string): UseQueryResult<{
  coins: OwnedCoin[];
  total: bigint;
} | null, Error> {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const owner = account?.address;

  return useQuery({
    queryKey: ["splyt", "coins", coinType, owner ?? "anon"],
    enabled: !!owner,
    staleTime: 5_000,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!owner) return null;
      const out: OwnedCoin[] = [];
      let cursor: string | null | undefined = null;
      do {
        const page = await client.getCoins({ owner, coinType, cursor });
        for (const c of page.data) {
          out.push({ coinObjectId: c.coinObjectId, balance: BigInt(c.balance) });
        }
        cursor = page.hasNextPage ? page.nextCursor : null;
      } while (cursor);
      const total = out.reduce((acc, c) => acc + c.balance, 0n);
      return { coins: out, total };
    },
  });
}

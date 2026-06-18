"use client";

import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { USER_BM_KEY, buildDeepBook } from "@/lib/deepbook";

/**
 * The connected user's open order ids on `poolKey` (via their BalanceManager).
 * Empty when there's no wallet, no BalanceManager, or no resting orders.
 */
export function useOpenOrders(
  poolKey: string,
  balanceManagerId: string | null | undefined,
): UseQueryResult<string[], Error> {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const owner = account?.address;

  return useQuery({
    queryKey: [
      "splyt",
      "deepbook",
      "openorders",
      poolKey,
      balanceManagerId ?? "none",
      owner ?? "anon",
    ],
    enabled: !!owner && !!balanceManagerId,
    staleTime: 4_000,
    refetchInterval: 8_000,
    queryFn: async () => {
      if (!owner || !balanceManagerId) return [];
      const db = buildDeepBook(client, owner, balanceManagerId);
      return db.accountOpenOrders(poolKey, USER_BM_KEY);
    },
  });
}

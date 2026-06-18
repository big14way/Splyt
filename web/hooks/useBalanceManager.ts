"use client";

import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { BALANCE_MANAGER_TYPE } from "@/lib/deepbook";

/**
 * The connected user's DeepBook BalanceManager id (the first one they own), or
 * null if they don't have one yet. Trading requires a BalanceManager, so the
 * Trade form uses this to choose between "Create trading account" and placing
 * an order.
 *
 * Discovery is by owned object of the BalanceManager type — the SDK's
 * registry-based `getBalanceManagerIds` does not surface a freshly created
 * manager, so we create an owned one and look it up here.
 */
export function useBalanceManager(): UseQueryResult<string | null, Error> {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const owner = account?.address;

  return useQuery({
    queryKey: ["splyt", "deepbook", "bm", owner ?? "anon"],
    enabled: !!owner,
    staleTime: 10_000,
    queryFn: async () => {
      if (!owner) return null;
      let cursor: string | null | undefined = null;
      do {
        const page = await client.getOwnedObjects({
          owner,
          filter: { StructType: BALANCE_MANAGER_TYPE },
          cursor,
        });
        const found = page.data.find((o) => o.data?.objectId);
        if (found?.data?.objectId) return found.data.objectId;
        cursor = page.hasNextPage ? page.nextCursor : null;
      } while (cursor);
      return null;
    },
  });
}

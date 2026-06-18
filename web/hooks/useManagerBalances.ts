"use client";

import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { USER_BM_KEY, buildDeepBook } from "@/lib/deepbook";
import { findPool } from "@/lib/pools";

export interface ManagerCoinBalance {
  coinKey: string;
  balance: number;
}

/**
 * The user's available balances inside their BalanceManager for a pool's base
 * and quote coins. Funds land here after depositing or cancelling an order;
 * the Trade panel offers a Withdraw to move them back to the wallet.
 */
export function useManagerBalances(
  poolKey: string,
  balanceManagerId: string | null | undefined,
): UseQueryResult<ManagerCoinBalance[], Error> {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const owner = account?.address;
  const pool = findPool(poolKey);

  return useQuery({
    queryKey: [
      "splyt",
      "deepbook",
      "mgrbal",
      poolKey,
      balanceManagerId ?? "none",
      owner ?? "anon",
    ],
    enabled: !!owner && !!balanceManagerId && !!pool,
    staleTime: 4_000,
    refetchInterval: 8_000,
    queryFn: async (): Promise<ManagerCoinBalance[]> => {
      if (!owner || !balanceManagerId || !pool) return [];
      const db = buildDeepBook(client, owner, balanceManagerId);
      const keys = Array.from(new Set([pool.baseSymbol, pool.quoteSymbol]));
      const out: ManagerCoinBalance[] = [];
      for (const coinKey of keys) {
        try {
          const b = await db.checkManagerBalance(USER_BM_KEY, coinKey);
          if (b.balance > 0) out.push({ coinKey, balance: b.balance });
        } catch {
          // Coin not held in the manager — skip.
        }
      }
      return out;
    },
  });
}

"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { Card, CardTitle } from "@/components/Card";
import {
  PT_DECIMALS,
  PT_TYPE,
  UNDERLYING_DECIMALS,
  UNDERLYING_SYMBOL,
  UNDERLYING_TYPE,
  YT_DECIMALS,
  YT_TYPE,
} from "@/lib/config";
import { formatBaseCompact } from "@/lib/format";
import { useCoins } from "@/hooks/useCoins";

function BalanceCard({
  title,
  color,
  amount,
  decimals,
  symbol,
  type,
}: {
  title: string;
  color: string;
  amount: bigint;
  decimals: number;
  symbol: string;
  type: string;
}) {
  return (
    <Card className="bg-surface-2 space-y-2">
      <div className="flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <span
          className="text-[11px] uppercase tracking-wider font-medium"
          style={{ color }}
        >
          {symbol}
        </span>
      </div>
      <div className="font-mono tabular text-2xl">
        {formatBaseCompact(amount, decimals, 4)}
      </div>
      <div className="text-[11px] text-text-dim font-mono break-all">
        {type.split("::").slice(-2).join("::")}
      </div>
    </Card>
  );
}

export function PortfolioBalances() {
  const account = useCurrentAccount();
  const sui = useCoins(UNDERLYING_TYPE);
  const pt = useCoins(PT_TYPE);
  const yt = useCoins(YT_TYPE);

  if (!account) {
    return (
      <Card>
        <div className="text-text-dim text-sm">
          Connect a wallet to see your PT and YT balances.
        </div>
      </Card>
    );
  }

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <BalanceCard
        title={UNDERLYING_SYMBOL}
        color="var(--text-dim)"
        amount={sui.data?.total ?? 0n}
        decimals={UNDERLYING_DECIMALS}
        symbol={UNDERLYING_SYMBOL}
        type={UNDERLYING_TYPE}
      />
      <BalanceCard
        title="Principal Tokens"
        color="var(--pt)"
        amount={pt.data?.total ?? 0n}
        decimals={PT_DECIMALS}
        symbol="PT"
        type={PT_TYPE}
      />
      <BalanceCard
        title="Yield Tokens"
        color="var(--yt)"
        amount={yt.data?.total ?? 0n}
        decimals={YT_DECIMALS}
        symbol="YT"
        type={YT_TYPE}
      />
    </div>
  );
}

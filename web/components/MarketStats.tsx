"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, StatNumber } from "@/components/Card";
import { useMarketState } from "@/hooks/useMarketState";
import { formatBaseCompact } from "@/lib/format";
import { UNDERLYING_DECIMALS, UNDERLYING_SYMBOL } from "@/lib/config";

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "Matured";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function MarketStats() {
  const { data, isLoading, error } = useMarketState();
  const now = useNow();

  const tvl = data
    ? formatBaseCompact(data.principalValue, UNDERLYING_DECIMALS, 4)
    : "—";
  const accrued = data
    ? formatBaseCompact(data.yieldValue, UNDERLYING_DECIMALS, 4)
    : "—";
  const ttm = data ? Number(data.maturityMs) - now : 0;
  const status = data
    ? data.isMatured || ttm <= 0
      ? "Matured"
      : "Active"
    : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-[12px] text-text-dim">
          {data ? (
            <>
              Maturity in <span className="text-text">{fmtCountdown(ttm)}</span>
              <span className="mx-2 opacity-40">·</span>
              PT supply{" "}
              <span className="text-text font-mono">
                {formatBaseCompact(data.ptSupply, UNDERLYING_DECIMALS, 2)}
              </span>
              <span className="mx-2 opacity-40">·</span>
              YT supply{" "}
              <span className="text-text font-mono">
                {formatBaseCompact(data.ytSupply, UNDERLYING_DECIMALS, 2)}
              </span>
            </>
          ) : isLoading ? (
            "Loading market state…"
          ) : error ? (
            <span className="text-neg">Failed to read market: {error.message}</span>
          ) : null}
        </div>
        <span
          className={
            "text-[11px] font-medium uppercase tracking-wider px-2 py-1 rounded-md border border-border bg-surface-2 " +
            (status === "Matured" ? "text-warn" : "text-pos")
          }
        >
          {status}
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="bg-surface-2">
          <CardTitle>TVL (principal)</CardTitle>
          <StatNumber>{tvl}</StatNumber>
          <div className="text-[12px] text-text-dim mt-1">
            {UNDERLYING_SYMBOL}
          </div>
        </Card>
        <Card className="bg-surface-2">
          <CardTitle>Accrued yield</CardTitle>
          <StatNumber>{accrued}</StatNumber>
          <div className="text-[12px] text-text-dim mt-1">
            {UNDERLYING_SYMBOL}
          </div>
        </Card>
        <Card className="bg-surface-2">
          <CardTitle>Implied fixed APY</CardTitle>
          <StatNumber>—</StatNumber>
          <div className="text-[12px] text-text-dim mt-1">from PT mid</div>
        </Card>
      </div>
    </div>
  );
}

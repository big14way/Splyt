"use client";

import { useEffect, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { RedeemPanel } from "@/components/RedeemPanel";
import { EXPLORER, UNDERLYING_DECIMALS, UNDERLYING_SYMBOL } from "@/lib/config";
import { formatBaseCompact } from "@/lib/format";
import { buildMature } from "@/lib/tx";
import { useMarketState } from "@/hooks/useMarketState";

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "0";
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

export function RedeemSection() {
  const market = useMarketState();
  const account = useCurrentAccount();
  const queryClient = useQueryClient();
  const now = useNow();
  const [settleDigest, setSettleDigest] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);

  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const matured = market.data?.isMatured ?? false;
  const maturityMs = market.data ? Number(market.data.maturityMs) : 0;
  const ttm = maturityMs - now;
  const readyToSettle = !matured && market.data ? ttm <= 0 : false;

  function onSettle() {
    if (!account || isPending) return;
    setSettleError(null);
    setSettleDigest(null);
    signAndExecute(
      { transaction: buildMature() },
      {
        onSuccess: (res) => {
          setSettleDigest(res.digest);
          queryClient.invalidateQueries({ queryKey: ["splyt"] });
        },
        onError: (e) => setSettleError(e.message),
      },
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
              Maturity
            </div>
            <div className="text-[13px] text-text mt-0.5">
              {!market.data ? (
                "Loading…"
              ) : matured ? (
                <>
                  Settled · final yield{" "}
                  <span className="font-mono tabular">
                    {formatBaseCompact(
                      market.data.finalYield,
                      UNDERLYING_DECIMALS,
                      4,
                    )}
                  </span>{" "}
                  {UNDERLYING_SYMBOL}
                </>
              ) : readyToSettle ? (
                <>Maturity reached — anyone can call <span className="font-mono">mature</span> to snapshot final yield.</>
              ) : (
                <>
                  Matures in{" "}
                  <span className="font-mono tabular text-text">
                    {fmtCountdown(ttm)}
                  </span>
                  . Redeem panels enable after settlement.
                </>
              )}
            </div>
          </div>
          <span
            className={
              "text-[11px] font-medium uppercase tracking-wider px-2 py-1 rounded-md border border-border bg-surface-2 " +
              (matured ? "text-warn" : readyToSettle ? "text-warn" : "text-pos")
            }
          >
            {matured ? "Matured" : readyToSettle ? "Ready" : "Active"}
          </span>
        </div>

        {readyToSettle && (
          <div className="space-y-2">
            <Button
              onClick={onSettle}
              disabled={!account || isPending}
              className="h-10"
            >
              {isPending ? "Signing…" : account ? "Settle market" : "Connect wallet"}
            </Button>
            {settleError && (
              <div className="text-[12px] text-neg break-words">
                {settleError}
              </div>
            )}
            {settleDigest && (
              <div className="text-[12px] text-text-dim">
                Submitted ·{" "}
                <a
                  className="text-sui hover:text-sui-deep underline-offset-2 hover:underline font-mono"
                  href={EXPLORER.txUrl(settleDigest)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {settleDigest.slice(0, 10)}…
                </a>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <RedeemPanel side="pt" />
        <RedeemPanel side="yt" />
      </div>
    </div>
  );
}

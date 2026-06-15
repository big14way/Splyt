"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  EXPLORER,
  PT_DECIMALS,
  PT_TYPE,
  UNDERLYING_DECIMALS,
  UNDERLYING_SYMBOL,
  YT_DECIMALS,
  YT_TYPE,
} from "@/lib/config";
import { formatBaseCompact, parseBase } from "@/lib/format";
import { buildRedeemPt, buildRedeemYt } from "@/lib/tx";
import { useCoins } from "@/hooks/useCoins";
import { useMarketState } from "@/hooks/useMarketState";

export type Side = "pt" | "yt";

const META: Record<
  Side,
  {
    title: string;
    label: string;
    coinType: string;
    coinDecimals: number;
    colorClass: string;
    colorVar: string;
  }
> = {
  pt: {
    title: "Redeem PT",
    label: "PT",
    coinType: PT_TYPE,
    coinDecimals: PT_DECIMALS,
    colorClass: "text-pt",
    colorVar: "var(--pt)",
  },
  yt: {
    title: "Redeem YT",
    label: "YT",
    coinType: YT_TYPE,
    coinDecimals: YT_DECIMALS,
    colorClass: "text-yt",
    colorVar: "var(--yt)",
  },
};

/**
 * Compute the YT pro-rata payout for `amount` YT, matching the on-chain
 * mul_div round-down. Returns null if the snapshot values aren't set yet
 * (i.e. market isn't matured).
 */
function previewYt(
  amount: bigint,
  finalYield: bigint,
  finalYtSupply: bigint,
): bigint | null {
  if (finalYtSupply === 0n) return null;
  return (amount * finalYield) / finalYtSupply;
}

export function RedeemPanel({ side }: { side: Side }) {
  const meta = META[side];
  const account = useCurrentAccount();
  const coinsQ = useCoins(meta.coinType);
  const market = useMarketState();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const balance = coinsQ.data?.total ?? 0n;
  const parsed = parseBase(amount, meta.coinDecimals);
  const matured = market.data?.isMatured ?? false;

  const disabledReason = (() => {
    if (!account) return "Connect wallet";
    if (!matured) return "Awaits maturity";
    if (balance === 0n) return `No ${meta.label} to redeem`;
    if (!parsed || parsed <= 0n) return "Enter an amount";
    if (parsed > balance) return `Exceeds ${meta.label} balance`;
    return null;
  })();

  let payout: bigint | null = null;
  if (parsed && parsed > 0n) {
    if (side === "pt") {
      payout = parsed; // 1:1 by construction
    } else if (market.data) {
      payout = previewYt(parsed, market.data.finalYield, market.data.finalYtSupply);
    }
  }

  function onMax() {
    if (balance === 0n) return;
    setAmount(
      formatBaseCompact(balance, meta.coinDecimals, 6).replace(/,/g, ""),
    );
  }

  function onRedeem() {
    if (!parsed || disabledReason) return;
    setError(null);
    setLastDigest(null);
    try {
      const ids = (coinsQ.data?.coins ?? []).map((c) => c.coinObjectId);
      const tx =
        side === "pt"
          ? buildRedeemPt(ids, parsed)
          : buildRedeemYt(ids, parsed);
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (res) => {
            setLastDigest(res.digest);
            setAmount("");
            queryClient.invalidateQueries({ queryKey: ["splyt"] });
            queryClient.invalidateQueries({ queryKey: ["@mysten/dapp-kit"] });
          },
          onError: (e) => setError(e.message),
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-text-dim font-medium">
            {meta.title}
          </div>
          <div className="text-[13px] text-text-dim mt-0.5">
            {side === "pt"
              ? `Burn PT for ${UNDERLYING_SYMBOL} 1:1.`
              : `Burn YT for a pro-rata share of accrued yield.`}
          </div>
        </div>
        <div className="text-right text-[12px] text-text-dim">
          <div>Balance</div>
          <div className="font-mono tabular text-text">
            <span className={meta.colorClass}>{meta.label}</span>{" "}
            {formatBaseCompact(balance, meta.coinDecimals, 4)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[12px] text-text-dim">
          <label htmlFor={`redeem-${side}`}>Amount</label>
          <button
            type="button"
            onClick={onMax}
            disabled={balance === 0n}
            className="text-text-dim hover:text-text disabled:opacity-40"
          >
            Max {formatBaseCompact(balance, meta.coinDecimals, 4)}
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-btn bg-surface-2 border border-border px-3 h-12 focus-within:border-sui">
          <input
            id={`redeem-${side}`}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent outline-none text-text font-mono tabular text-lg"
          />
          <span className={`text-[12px] ${meta.colorClass}`}>{meta.label}</span>
        </div>
      </div>

      <div className="rounded-btn border border-border bg-surface-2/60 px-4 py-3 text-[13px] flex items-center justify-between">
        <span className="text-text-dim">You receive</span>
        <span className="font-mono tabular text-text">
          {payout !== null
            ? formatBaseCompact(payout, UNDERLYING_DECIMALS, 4)
            : "—"}{" "}
          <span className="text-text-dim">{UNDERLYING_SYMBOL}</span>
        </span>
      </div>

      <Button
        onClick={onRedeem}
        disabled={!!disabledReason || isPending}
        className="w-full h-11"
      >
        {isPending ? "Signing…" : disabledReason ?? meta.title}
      </Button>

      {error && (
        <div className="text-[12px] text-neg break-words">{error}</div>
      )}
      {lastDigest && (
        <div className="text-[12px] text-text-dim">
          Submitted ·{" "}
          <a
            className="text-sui hover:text-sui-deep underline-offset-2 hover:underline font-mono"
            href={EXPLORER.txUrl(lastDigest)}
            target="_blank"
            rel="noreferrer"
          >
            {lastDigest.slice(0, 10)}…
          </a>
        </div>
      )}
    </Card>
  );
}

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
import { bigintMin, formatBaseCompact, parseBase } from "@/lib/format";
import { buildCombine } from "@/lib/tx";
import { useCoins } from "@/hooks/useCoins";
import { useMarketState } from "@/hooks/useMarketState";

export function CombinePanel() {
  const account = useCurrentAccount();
  const ptQ = useCoins(PT_TYPE);
  const ytQ = useCoins(YT_TYPE);
  const market = useMarketState();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const ptTotal = ptQ.data?.total ?? 0n;
  const ytTotal = ytQ.data?.total ?? 0n;
  const cap = bigintMin(ptTotal, ytTotal);
  const parsed = parseBase(amount, PT_DECIMALS);
  const matured = market.data?.isMatured ?? false;

  const disabledReason = (() => {
    if (!account) return "Connect wallet";
    if (matured) return "Market matured";
    if (cap === 0n) return "No PT + YT to combine";
    if (!parsed || parsed <= 0n) return "Enter an amount";
    if (parsed > cap) return "Exceeds matched PT/YT";
    return null;
  })();

  function onMax() {
    if (cap === 0n) return;
    setAmount(formatBaseCompact(cap, PT_DECIMALS, 6).replace(/,/g, ""));
  }

  function onCombine() {
    if (!parsed || disabledReason || !account) return;
    setError(null);
    setLastDigest(null);
    try {
      const tx = buildCombine({
        amount: parsed,
        sender: account.address,
        ptCoinIds: (ptQ.data?.coins ?? []).map((c) => c.coinObjectId),
        ytCoinIds: (ytQ.data?.coins ?? []).map((c) => c.coinObjectId),
      });
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
            Combine
          </div>
          <div className="text-[13px] text-text-dim mt-0.5">
            Burn equal PT + YT to get {UNDERLYING_SYMBOL} back. Pre-maturity only.
          </div>
        </div>
        <div className="text-right text-[12px] text-text-dim space-y-0.5">
          <div>
            <span className="text-pt">PT</span>{" "}
            <span className="font-mono tabular text-text">
              {formatBaseCompact(ptTotal, PT_DECIMALS, 4)}
            </span>
          </div>
          <div>
            <span className="text-yt">YT</span>{" "}
            <span className="font-mono tabular text-text">
              {formatBaseCompact(ytTotal, YT_DECIMALS, 4)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[12px] text-text-dim">
          <label htmlFor="combine-amount">Amount (matched)</label>
          <button
            type="button"
            onClick={onMax}
            disabled={cap === 0n}
            className="text-text-dim hover:text-text disabled:opacity-40"
          >
            Max {formatBaseCompact(cap, PT_DECIMALS, 4)}
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-btn bg-surface-2 border border-border px-3 h-12 focus-within:border-sui">
          <input
            id="combine-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent outline-none text-text font-mono tabular text-lg"
          />
          <span className="text-text-dim text-[12px]">
            <span className="text-pt">PT</span>{" "}
            <span className="opacity-50">+</span>{" "}
            <span className="text-yt">YT</span>
          </span>
        </div>
      </div>

      <div className="rounded-btn border border-border bg-surface-2/60 px-4 py-3 text-[13px] flex items-center justify-between">
        <span className="text-text-dim">You receive</span>
        <span className="font-mono tabular text-text">
          {parsed && parsed > 0n
            ? formatBaseCompact(parsed, UNDERLYING_DECIMALS, 4)
            : "0"}{" "}
          <span className="text-text-dim">{UNDERLYING_SYMBOL}</span>
        </span>
      </div>

      <Button
        onClick={onCombine}
        disabled={!!disabledReason || isPending}
        className="w-full h-11"
      >
        {isPending ? "Signing…" : disabledReason ?? "Combine"}
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
